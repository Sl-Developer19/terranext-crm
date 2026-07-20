'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { provisionUserSchema, type ProvisionUserInput } from '../schema';

export interface ProvisionUserResult {
  uid: string;
  /**
   * Firebase password-reset link (Admin SDK, ~1h expiry). No transactional
   * email provider is selected yet (Doc 21 RR — Phase 10 dependency), so the
   * provisioning admin shares this via an existing channel — the same
   * pattern as scripts/bootstrap-admin.mjs. Shown once; not persisted.
   */
  resetLink: string;
}

/**
 * Creates a staff Auth user (no password — set via the reset link),
 * `users/{uid}` profile, and custom claims (Doc 19 provisionUser, Doc 04 §5).
 * No self-signup path exists anywhere else in the app (Doc 10 §1).
 */
export async function provisionUser(
  input: ProvisionUserInput,
): Promise<Result<ProvisionUserResult>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'users:create')) return permissionError();

  const parsed = provisionUserSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }
  const { email, displayName, phone, role, assignedBatchIds } = parsed.data;

  const auth = adminAuth();
  const db = adminDb();

  try {
    await auth.getUserByEmail(email);
    return conflictError('A staff account with this email already exists.');
  } catch (error) {
    // auth/user-not-found is the expected path; anything else is unexpected.
    if ((error as { code?: string }).code !== 'auth/user-not-found') {
      return internalError();
    }
  }

  let uid: string;
  try {
    const created = await auth.createUser({ email, displayName, emailVerified: false });
    uid = created.uid;
    await auth.setCustomUserClaims(uid, { role, branchId: session.branchId });
  } catch {
    return internalError('Could not create the account. Please try again.');
  }

  const now = new Date();
  await db.collection('users').doc(uid).set({
    schemaVersion: 1,
    branchId: session.branchId,
    displayName,
    email,
    phone,
    role,
    status: 'active',
    assignedBatchIds,
    photoUrl: null,
    mustChangePassword: true,
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
    entityType: 'user',
    entityId: uid,
    entityPath: `users/${uid}`,
    changes: { role: { before: null, after: role } },
    context: { feature: 'users' },
  });

  const resetLink = await auth.generatePasswordResetLink(email);
  return ok({ uid, resetLink });
}
