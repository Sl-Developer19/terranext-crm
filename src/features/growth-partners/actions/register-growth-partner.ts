'use server';

import { findDefaultLeadershipLevelSlug } from '@/features/leadership-levels';
import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { registerGrowthPartnerSchema, type RegisterGrowthPartnerInput } from '../schema';

/**
 * Registers a Growth Partner candidate (Doc 25 §4 step 1). No Firebase Auth
 * user or login exists yet — that is minted at approval time
 * (`decideGrowthPartner`), matching "no self-signup path exists anywhere in
 * the app" (`lib/auth/session.ts`).
 */
export async function registerGrowthPartner(
  input: RegisterGrowthPartnerInput,
): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'growthPartners:create')) return permissionError();

  const parsed = registerGrowthPartnerSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { displayName, email, phone, organizationName } = parsed.data;

  const db = adminDb();
  const normalizedEmail = email.trim().toLowerCase();
  const defaultLevelSlug = await findDefaultLeadershipLevelSlug();

  try {
    // Transactional check-then-write: two concurrent registrations for the
    // same email must not both pass the duplicate check and land as two
    // `growthPartners` docs (mirrors `community-partners/repository.ts`'s
    // `createCommunityPartnerRecord`, which closes this exact race).
    const ref = db.collection('growthPartners').doc();
    const now = new Date();
    const duplicate = await db.runTransaction(async (tx) => {
      const existing = await tx.get(
        db
          .collection('growthPartners')
          .where('email', '==', normalizedEmail)
          .where('deletedAt', '==', null)
          .limit(1),
      );
      if (!existing.empty) return true;

      tx.set(ref, {
        schemaVersion: 1,
        humanPartnerId: null,
        displayName,
        email: normalizedEmail,
        phone,
        organizationName: organizationName || null,
        status: 'pending_approval',
        leadershipLevel: defaultLevelSlug,
        scanCount: 0,
        referralCount: 0,
        authUid: null,
        approvedAt: null,
        approvedBy: null,
        lastLoginAt: null,
        createdAt: now,
        createdBy: session.uid,
        updatedAt: now,
        updatedBy: session.uid,
        deletedAt: null,
        deletedBy: null,
      });
      return false;
    });
    if (duplicate) {
      return conflictError('A Growth Partner with this email is already registered.');
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'growth_partner',
      entityId: ref.id,
      entityPath: `growthPartners/${ref.id}`,
      context: { feature: 'growth-partners' },
    });

    return ok({ id: ref.id });
  } catch {
    return internalError('Could not register the Growth Partner. Please try again.');
  }
}
