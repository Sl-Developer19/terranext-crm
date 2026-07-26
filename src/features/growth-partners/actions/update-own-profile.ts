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

import { updateOwnProfileSchema, type UpdateOwnProfileInput } from '../schema';

/**
 * A Growth Partner editing their own profile (Doc 25 §6/§16) — row-scoped by
 * `requirePartnerSession()`, not `can()`; there is no permission matrix for
 * a partner acting on their own record, only "is this my own document."
 */
export async function updateOwnProfile(
  input: UpdateOwnProfileInput,
): Promise<Result<{ ok: true }>> {
  const session = await getPartnerSession();
  if (!session) return permissionError('Sign in required.');

  const parsed = updateOwnProfileSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { displayName, phone, organizationName } = parsed.data;

  try {
    const ref = adminDb().collection('growthPartners').doc(session.partnerId);
    const now = new Date();
    await ref.update({
      displayName,
      phone,
      organizationName: organizationName || null,
      updatedAt: now,
      updatedBy: session.uid,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: 'growth_partner',
      action: 'update',
      entityType: 'growth_partner',
      entityId: session.partnerId,
      entityPath: `growthPartners/${session.partnerId}`,
      context: { feature: 'growth-partners' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update your profile. Please try again.');
  }
}
