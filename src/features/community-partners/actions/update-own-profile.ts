'use server';

import { writeAudit } from '@/lib/audit/write';
import { adminDb } from '@/lib/firebase/admin';
import { getPartnerSession } from '@/lib/auth/partner-session';
import {
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { updateOwnCommunityProfileSchema, type UpdateOwnCommunityProfileInput } from '../schema';

/**
 * A Community Partner editing their own profile — mirrors
 * `growth-partners/actions/update-own-profile.ts` exactly (ADR-014: same
 * parallel-actor pattern). Row-scoped by `requirePartnerSession()`, not
 * `can()` — there is no permission matrix for a partner acting on its own
 * record, only "is this my own document." `actorType` on the session token
 * is always `'growth_partner'` for every external-partner kind (ADR-014), so
 * `actorRole: 'growth_partner'` here matches the convention already used by
 * `decide-community-partner.ts`'s Auth claims, not a Growth Partner action.
 */
export async function updateOwnCommunityProfile(
  input: UpdateOwnCommunityProfileInput,
): Promise<Result<{ ok: true }>> {
  const session = await getPartnerSession();
  if (!session) return permissionError('Sign in required.');
  if (session.partnerType !== 'community_business') return permissionError();

  const parsed = updateOwnCommunityProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { orgName, contactName, phone } = parsed.data;

  try {
    const ref = adminDb().collection('communityPartners').doc(session.partnerId);
    const now = new Date();
    await ref.update({
      orgName,
      contactName,
      phone,
      updatedAt: now,
      updatedBy: session.uid,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: 'growth_partner',
      action: 'update',
      entityType: 'community_partner',
      entityId: session.partnerId,
      entityPath: `communityPartners/${session.partnerId}`,
      context: { feature: 'community-partners' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update your profile. Please try again.');
  }
}
