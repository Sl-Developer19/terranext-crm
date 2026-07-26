'use server';

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

  try {
    const existing = await db
      .collection('growthPartners')
      .where('email', '==', normalizedEmail)
      .where('deletedAt', '==', null)
      .limit(1)
      .get();
    if (!existing.empty) {
      return conflictError('A Growth Partner with this email is already registered.');
    }

    const ref = db.collection('growthPartners').doc();
    const now = new Date();
    await ref.set({
      schemaVersion: 1,
      displayName,
      email: normalizedEmail,
      phone,
      organizationName: organizationName || null,
      status: 'pending_approval',
      leadershipLevel: 'bronze',
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
