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
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { canDecide } from '../logic';
import { decideGrowthPartnerSchema, type DecideGrowthPartnerInput } from '../schema';

/**
 * Approves or rejects a pending Growth Partner (Doc 25 §2/§4). Approval mints
 * the partner's Firebase Auth account and `growth_partner` custom claim
 * (ADR-014) — the account and its first login link do not exist before this
 * runs, mirroring `provisionUser`'s welcome-email flow exactly.
 */
export async function decideGrowthPartner(
  input: DecideGrowthPartnerInput,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'growthPartners:approve')) return permissionError();

  const parsed = decideGrowthPartnerSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'form'] ??= issue.message;
    }
    return validationError(fields);
  }
  const { partnerId, decision, reason } = parsed.data;

  const db = adminDb();
  const ref = db.collection('growthPartners').doc(partnerId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('deletedAt') !== null) {
    return notFoundError('Growth Partner not found.');
  }
  const status = snap.get('status');
  if (!canDecide(status)) {
    return conflictError('This Growth Partner has already been decided.');
  }

  const now = new Date();
  const displayName = snap.get('displayName') as string;
  const email = snap.get('email') as string;

  if (decision === 'reject') {
    await ref.update({
      status: 'rejected',
      updatedAt: now,
      updatedBy: session.uid,
    });
    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'growth_partner',
      entityId: partnerId,
      entityPath: `growthPartners/${partnerId}`,
      changes: { status: { before: status, after: 'rejected' } },
      context: reason ? { feature: 'growth-partners', reason } : { feature: 'growth-partners' },
    });
    return ok({ ok: true });
  }

  const auth = adminAuth();
  let authUid: string;
  try {
    try {
      const existingUser = await auth.getUserByEmail(email);
      authUid = existingUser.uid;
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
      const created = await auth.createUser({ email, displayName, emailVerified: false });
      authUid = created.uid;
    }
    // No `role` claim (ADR-014): a Growth Partner must never satisfy
    // `toStaffRole()`/`isStaff()` — it is a parallel actor namespace.
    await auth.setCustomUserClaims(authUid, {
      actorType: 'growth_partner',
      partnerId,
      partnerStatus: 'active',
    });
  } catch {
    return internalError('Could not create the partner account. Please try again.');
  }

  await ref.update({
    status: 'active',
    authUid,
    approvedAt: now,
    approvedBy: session.uid,
    updatedAt: now,
    updatedBy: session.uid,
  });

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'status_change',
    entityType: 'growth_partner',
    entityId: partnerId,
    entityPath: `growthPartners/${partnerId}`,
    changes: { status: { before: status, after: 'active' } },
    context: { feature: 'growth-partners' },
  });

  const origin = await appOrigin();
  const brandedLink = await generateBrandedResetLink(email, origin);
  if (brandedLink) {
    const bodyText =
      `${displayName}, your Growth Partner account has been approved.\n\n` +
      'Set your password to sign in to the partner portal for the first time.';
    const outcome = await getEmailProvider().send({
      to: email,
      subject: 'Your Growth Partner account is approved',
      body: [
        bodyText,
        '',
        `Set your password: ${brandedLink}`,
        '',
        'This link expires in 1 hour and can only be used once.',
      ].join('\n'),
      html: renderBrandedEmailHtml({
        heading: 'Welcome, Growth Partner',
        preheader: 'Your Growth Partner account is approved.',
        bodyText,
        cta: { label: 'Set your password', url: brandedLink },
        footerNote: 'This link expires in 1 hour and can only be used once.',
        appOrigin: origin,
      }),
    });
    if (outcome.status === 'failed') {
      console.error('Growth Partner welcome email failed to send:', outcome.reason);
    }
  }

  return ok({ ok: true });
}
