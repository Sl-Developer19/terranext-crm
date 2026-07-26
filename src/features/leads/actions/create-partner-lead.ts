'use server';

import { writeAudit } from '@/lib/audit/write';
import { getPartnerSession } from '@/lib/auth/partner-session';
import { adminDb } from '@/lib/firebase/admin';
import {
  conflictError,
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { createPartnerLeadSchema, type CreatePartnerLeadInput } from '../schema';

/**
 * A Growth Partner submitting a referral (Doc 25 §4). Always `source:
 * 'referral'`, `partnerId` set from the session — never a value the caller
 * supplies. Rides the same `leads` pipeline every other source uses (Doc 25
 * §1); dedupe-never-rejects (BR-07) applies here exactly as it does to the
 * staff and website intake paths.
 */
export async function createPartnerLead(
  input: CreatePartnerLeadInput,
): Promise<Result<{ id: string; possibleDuplicate: boolean }>> {
  const session = await getPartnerSession();
  if (!session) return permissionError('Sign in required.');

  const parsed = createPartnerLeadSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { name, phone, email, programmeInterest, consentGiven } = parsed.data;

  const db = adminDb();
  const partnerSnap = await db.collection('growthPartners').doc(session.partnerId).get();
  if (!partnerSnap.exists || partnerSnap.get('status') !== 'active') {
    return conflictError('Your partner account is not active.');
  }

  const now = new Date();

  try {
    const existing = await db.collection('leads').where('phone', '==', phone).limit(1).get();

    const ref = db.collection('leads').doc();
    await ref.set({
      schemaVersion: 1,
      branchId: 'HQ',
      name,
      phone,
      email: email ?? null,
      source: 'referral',
      sourceDetail: {},
      programmeInterestId: programmeInterest || null,
      academyId: null,
      stage: 'new',
      assignedToUid: null,
      partnerId: session.partnerId,
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

    await ref.collection('activities').add({
      type: 'note',
      summary: 'Referral submitted by Growth Partner',
      at: now,
      byUid: session.uid,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: 'growth_partner',
      action: 'create',
      entityType: 'lead',
      entityId: ref.id,
      entityPath: `leads/${ref.id}`,
      context: { feature: 'growth-partners', reason: `partner:${session.partnerId}` },
    });

    return ok({ id: ref.id, possibleDuplicate: !existing.empty });
  } catch {
    return internalError('Could not submit the referral. Please try again.');
  }
}
