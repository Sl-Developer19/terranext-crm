'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  preconditionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { conversionBlocker, latestRecommendedProgramme } from '../logic';
import {
  findFamilyById,
  findParentById,
  findParentSessions,
  logParentSessionRecord,
  markParentConverted,
} from '../repository';
import {
  convertParentSchema,
  logParentSessionSchema,
  type ConvertParentInput,
  type LogParentSessionInput,
} from '../schema';

/** Parent counselling and conversion (the parent-first path's BR-02 analogue). */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    fields[issue.path.join('.') || 'form'] ??= issue.message;
  }
  return fields;
}

export async function logParentSession(
  input: LogParentSessionInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'parents:update')) return permissionError();

  const parsed = logParentSessionSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const {
    familyId,
    parentId,
    heldAt,
    mode,
    notes,
    outcome,
    recommendedProgrammeId,
    nextFollowUpAt,
  } = parsed.data;

  try {
    const [family, parent] = await Promise.all([
      findFamilyById(familyId),
      findParentById(familyId, parentId),
    ]);
    if (!family) return notFoundError('Family not found.');
    if (!parent) return notFoundError('Parent not found.');

    const id = await logParentSessionRecord(
      familyId,
      {
        parentId,
        heldAt,
        mode,
        notes,
        outcome,
        recommendedProgrammeId: recommendedProgrammeId ?? null,
        nextFollowUpAt: nextFollowUpAt || null,
      },
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'parent_session',
      entityId: id,
      entityPath: `families/${familyId}/sessions/${id}`,
      changes: { outcome: { before: null, after: outcome } },
      context: { feature: 'parents' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not record the session. Please try again.');
  }
}

/**
 * Converts a counselled parent into a lead of their own.
 *
 * Gated on a prior `recommended` counselling outcome — the same discipline
 * BR-02 applies to participants. Without it, every parent who answered the
 * phone becomes a lead and the follow-up queue stops meaning anything.
 *
 * The parent becomes a normal `leads` document, so the existing lead
 * pipeline, assignment, and reporting apply unchanged. No parallel pipeline.
 */
export async function convertParentToLead(
  input: ConvertParentInput,
): Promise<Result<{ leadId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'parents:update') || !can(session.role, 'leads:create')) {
    return permissionError();
  }

  const parsed = convertParentSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { familyId, parentId, programmeInterest } = parsed.data;

  try {
    const [family, parent, sessions] = await Promise.all([
      findFamilyById(familyId),
      findParentById(familyId, parentId),
      findParentSessions(familyId),
    ]);
    if (!family) return notFoundError('Family not found.');
    if (!parent) return notFoundError('Parent not found.');

    if (parent.leadId) {
      // Already converted — idempotent rather than creating a duplicate lead.
      return ok({ leadId: parent.leadId });
    }

    const parentSessions = sessions.filter((s) => s.parentId === parentId);
    const blocker = conversionBlocker(parentSessions);
    if (blocker) return preconditionError('BR-02', blocker);

    const db = adminDb();
    const now = new Date();
    const leadRef = db.collection('leads').doc();
    const parentRef = db.collection('families').doc(familyId).collection('parents').doc(parentId);

    // Lead creation and marking the parent converted commit atomically, so a
    // retry after a partial failure (crash, network drop) can never create a
    // second lead: the transaction re-checks parent.leadId itself, closing
    // the same race the top-of-function idempotency check can't catch alone.
    const committed = await db.runTransaction(async (tx) => {
      const parentSnap = await tx.get(parentRef);
      const existingLeadId = parentSnap.get('leadId') as string | null | undefined;
      if (existingLeadId) return { leadId: existingLeadId, created: false as const };

      tx.set(leadRef, {
        schemaVersion: 1,
        branchId: session.branchId,
        name: parent.name,
        phone: parent.phone,
        email: parent.email,
        source: 'referral',
        // Provenance: this lead came from a counselled parent, which the
        // college/campaign source fields could not express.
        sourceDetail: { familyId, parentId },
        programmeInterestId:
          programmeInterest || latestRecommendedProgramme(parentSessions) || null,
        academyId: null,
        stage: 'counselling_attended',
        assignedToUid: session.role === 'consultant' ? session.uid : null,
        nextFollowUpAt: null,
        lostReason: null,
        participantId: null,
        consent: { given: true, at: now, textVersion: 'v1' },
        createdAt: now,
        createdBy: session.uid,
        updatedAt: now,
        updatedBy: session.uid,
        deletedAt: null,
        deletedBy: null,
      });
      tx.update(parentRef, {
        conversionStatus: 'lead_created',
        leadId: leadRef.id,
        updatedAt: now,
        updatedBy: session.uid,
      });

      return { leadId: leadRef.id, created: true as const };
    });

    if (committed.created) {
      try {
        await leadRef.collection('activities').add({
          type: 'note',
          summary: `Converted from parent counselling (family ${family.familyName})`,
          at: now,
          byUid: session.uid,
        });
      } catch {
        // Non-fatal — the lead and the parent's conversion state are already
        // committed atomically above; only the activity note is missing.
      }

      // Re-applies the same leadId/conversionStatus (already set above) and
      // rolls the family-level status up — kept as the single source of
      // truth for that rollup rather than duplicating it here.
      await markParentConverted(familyId, parentId, committed.leadId, session.uid);

      await writeAudit({
        actorUid: session.uid,
        actorRole: session.role,
        action: 'create',
        entityType: 'lead',
        entityId: committed.leadId,
        entityPath: `leads/${committed.leadId}`,
        changes: { source: { before: null, after: `parent:${parentId}` } },
        context: { feature: 'parents', reason: 'parent_conversion' },
      });
    }

    return ok({ leadId: committed.leadId });
  } catch {
    return internalError('Could not convert the parent. Please try again.');
  }
}
