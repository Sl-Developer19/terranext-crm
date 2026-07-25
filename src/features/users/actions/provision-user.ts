'use server';

import { writeAudit } from '@/lib/audit/write';
import { generateBrandedResetLink } from '@/lib/auth/reset-link';
import { getSession } from '@/lib/auth/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { appOrigin } from '@/lib/http/app-origin';
import { renderBrandedEmailHtml } from '@/lib/messaging/email-template';
import { getEmailProvider } from '@/lib/messaging/providers';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { canAssignRole } from '../logic';
import { provisionUserSchema, type ProvisionUserInput } from '../schema';

export interface ProvisionUserResult {
  uid: string;
  /**
   * Password-reset link (~1h expiry) pointing at our own branded
   * `/reset-password` page. A welcome email carrying this link is sent
   * automatically when an email provider is configured (Doc 10 §1
   * extension). Also returned here so the provisioning admin can share it
   * directly if delivery fails or no provider is configured — the same
   * fallback `scripts/bootstrap-admin.mjs` uses. Shown once; not persisted.
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

  // Closes the other route to the super role: provisioning a brand-new
  // account straight into Founder would sidestep the setUserRole guard
  // entirely.
  if (!canAssignRole(session.role, role)) {
    return permissionError('Only a Founder or System Administrator can create a Founder account.');
  }

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

  const origin = await appOrigin();
  const brandedLink = await generateBrandedResetLink(email, origin);
  // The account was just created, so a null result here means an unexpected
  // Identity Toolkit failure rather than "no such account" — fall back to
  // the raw Firebase link (the old behaviour) so the admin still has
  // something to share, and skip the email since there is no branded URL.
  const resetLink = brandedLink ?? (await auth.generatePasswordResetLink(email));

  if (brandedLink) {
    const bodyText =
      `${displayName}, an account has been created for you on TerraNext Business OS.\n\n` +
      'Set your password to sign in for the first time.';
    const outcome = await getEmailProvider().send({
      to: email,
      subject: 'Your TerraNext Business OS account is ready',
      body: [
        bodyText,
        '',
        `Set your password: ${brandedLink}`,
        '',
        'This link expires in 1 hour and can only be used once.',
      ].join('\n'),
      html: renderBrandedEmailHtml({
        heading: 'Welcome to TerraNext Business OS',
        preheader: 'Your TerraNext Business OS account is ready.',
        bodyText,
        cta: { label: 'Set your password', url: brandedLink },
        footerNote: 'This link expires in 1 hour and can only be used once.',
        appOrigin: origin,
      }),
    });
    if (outcome.status === 'failed') {
      console.error('Welcome email failed to send:', outcome.reason);
    }
  }

  return ok({ uid, resetLink });
}
