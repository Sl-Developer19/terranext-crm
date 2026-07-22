'use server';

import { allocateToBatch } from '@/features/batches/repository';
import { findProgrammeById } from '@/features/catalogue/repository';
import { br02Checklist } from '@/features/counselling';
import { listSessionsForLead } from '@/features/counselling/queries';
import { createFeeAccountRecord } from '@/features/fees/repository';
import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  preconditionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { hasBlockingDuplicate } from '../logic';
import { convertLeadRecord, findDuplicatesByPhone, isLeadConverted } from '../repository';
import { convertLeadSchema, type ConvertLeadInput } from '../schema';

/**
 * S14 — lead → participant (BR-01, BR-02, BR-04).
 *
 * Every gate the stepper showed is re-checked here. The UI's job is to make
 * the rules legible; this action's job is to enforce them, because a stepper
 * state is not an authorization.
 */
export async function convertLead(
  input: ConvertLeadInput,
): Promise<Result<{ participantId: string; enrolmentId: string; warnings: string[] }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  // BR-01: only ops_manager mints participant IDs (Doc 15).
  if (!can(session.role, 'admissions:create')) {
    return permissionError('Only an Operations Manager can convert a lead.');
  }

  const parsed = convertLeadSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    return validationError(fields);
  }
  const data = parsed.data;

  try {
    const existing = await isLeadConverted(data.leadId);
    if (existing) {
      return conflictError(`This lead was already converted to participant ${existing}.`);
    }

    // BR-02 — the counselling evidence, re-read from source.
    const sessions = await listSessionsForLead(data.leadId);
    const checklist = br02Checklist(sessions);
    if (!checklist.satisfied) {
      return preconditionError('BR-02', checklist.blocker ?? 'Counselling evidence is missing.');
    }
    const recommending = sessions.find((s) => s.recommendation);
    if (!recommending?.recommendation) {
      return preconditionError('BR-02', 'No counselling session names a recommended programme.');
    }

    // BR-01 — duplicates must be seen and consciously accepted, never silently
    // overridden by a client that simply omitted the flag.
    const duplicates = await findDuplicatesByPhone(data.phone);
    if (hasBlockingDuplicate(duplicates, data.acknowledgedDuplicate)) {
      return preconditionError(
        'BR-01',
        `A participant already exists on this phone number (${duplicates.map((d) => d.participantId).join(', ')}). Link to the existing record, or confirm this is a different person.`,
      );
    }

    const programme = await findProgrammeById(data.programmeId);
    if (!programme) return validationError({ programmeId: 'That programme no longer exists.' });

    const outcome = await convertLeadRecord({
      leadId: data.leadId,
      personal: {
        fullName: data.fullName,
        dob: data.dob,
        gender: data.gender ?? null,
        phone: data.phone,
        email: data.email ? data.email : null,
        address: data.address ?? null,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        emergencyContactRelation: data.emergencyContactRelation,
        parentName: data.parentName ?? null,
        parentPhone: data.parentPhone ?? null,
      },
      academyId: data.academyId,
      programmeId: data.programmeId,
      batchId: data.batchId ?? null,
      recommendationSnapshot: {
        sessionId: recommending.id,
        programmeId: recommending.recommendation.programmeId,
        remarks: recommending.recommendation.remarks,
      },
      actorUid: session.uid,
      branchId: session.branchId,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'participant',
      entityId: outcome.participantId,
      entityPath: `participants/${outcome.participantId}`,
      changes: {
        leadId: { before: null, after: data.leadId },
        programmeId: { before: null, after: data.programmeId },
      },
      context: {
        feature: 'admissions',
        ...(duplicates.length > 0
          ? {
              reason: `BR-01 duplicate acknowledged: ${duplicates.map((d) => d.participantId).join(', ')}`,
            }
          : {}),
      },
    });

    // Post-core steps. Each owns its own invariant, and neither is allowed to
    // undo an admission that is already valid — so a failure here is reported
    // as a warning the operator can act on, not a rolled-back conversion.
    const warnings: string[] = [];

    if (data.batchId) {
      const allocation = await allocateToBatch(
        data.batchId,
        outcome.participantId,
        outcome.enrolmentId,
        session.uid,
      );
      if (allocation === 'batch_full') {
        warnings.push(
          'The chosen batch was full by the time the admission committed (BR-04). The participant is enrolled but unallocated — allocate them to another batch.',
        );
      } else if (allocation === 'batch_missing') {
        warnings.push(
          'The chosen batch no longer exists. The participant is enrolled but unallocated.',
        );
      }
    }

    const feeCreated = await createFeeAccountRecord({
      participantId: outcome.participantId,
      enrolmentId: outcome.enrolmentId,
      programmeId: data.programmeId,
      enrolledAt: new Date(),
      totalPaise: programme.feePlanDefault.totalPaise,
      planInstallments: programme.feePlanDefault.installments,
      actorUid: session.uid,
      branchId: session.branchId,
    });
    if (!feeCreated) {
      warnings.push('A fee account already existed for this enrolment and was left untouched.');
    }

    return ok({ ...outcome, warnings });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'already_converted') {
      return conflictError('This lead was converted by someone else a moment ago.');
    }
    if (message === 'lead_missing') return notFoundError('Lead not found.');
    return internalError('Could not convert the lead. Please try again.');
  }
}
