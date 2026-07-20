'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { createLeadSchema, type CreateLeadInput } from '../schema';

export interface CreateLeadResult {
  id: string;
  /** True when an existing, non-deleted lead already shares this phone number. */
  possibleDuplicate: boolean;
}

/**
 * Internal staff lead creation (Doc 03 §1.3, Doc 16 S10). The public
 * website-facing intake is the separate `createLead` Cloud Function (Doc 19)
 * — out of scope here; this action is for consultant/ops-entered leads
 * (walk-in, referral, campaign, college, social).
 *
 * Consent is mandatory on every lead regardless of source (Doc 10 §7).
 * Duplicate phone numbers are never rejected (BR-07: no enquiry is ever
 * lost) — the caller is told so the UI can surface it, but the lead is
 * still created and left for a human to reconcile.
 */
export async function createLead(input: CreateLeadInput): Promise<Result<CreateLeadResult>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'leads:create')) return permissionError();

  const parsed = createLeadSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { name, phone, email, source, programmeInterest, consentGiven } = parsed.data;

  const db = adminDb();
  const now = new Date();

  try {
    // Single-field `phone` index only (Doc 03 §3) — dedupe is advisory here,
    // never a block (BR-07: no enquiry is ever lost).
    const existing = await db.collection('leads').where('phone', '==', phone).limit(1).get();

    const ref = db.collection('leads').doc();
    await ref.set({
      schemaVersion: 1,
      branchId: session.branchId,
      name,
      phone,
      email: email ?? null,
      source,
      sourceDetail: {},
      programmeInterestId: programmeInterest || null,
      academyId: null,
      stage: 'new',
      assignedToUid: session.role === 'consultant' ? session.uid : null,
      nextFollowUpAt: null,
      lostReason: null,
      participantId: null,
      consent: { given: consentGiven, at: now, textVersion: 'v1' },
      createdAt: now,
      createdBy: session.uid,
      updatedAt: now,
      updatedBy: session.uid,
      deletedAt: null,
      deletedBy: null,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'lead',
      entityId: ref.id,
      entityPath: `leads/${ref.id}`,
      context: { feature: 'leads' },
    });

    return ok({ id: ref.id, possibleDuplicate: !existing.empty });
  } catch {
    return internalError('Could not create the lead. Please try again.');
  }
}
