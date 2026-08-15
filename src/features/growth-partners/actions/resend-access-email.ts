'use server';

import { writeAudit } from '@/lib/audit/write';
import { generateBrandedResetLink } from '@/lib/auth/reset-link';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { appOrigin } from '@/lib/http/app-origin';
import { renderBrandedEmailHtml } from '@/lib/messaging/email-template';
import { getEmailProvider } from '@/lib/messaging/providers';
import { HOUR_MS, consumeRateLimit } from '@/lib/rate-limit/fixed-window';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  rateLimitedError,
  type Result,
} from '@/lib/utils/result';

import { getBrandingSettings } from '@/features/settings';

const PER_PARTNER_PER_HOUR = 3;

/**
 * Re-sends a Growth Partner's portal-access (password-set) email — for a
 * partner who is already `active` with an Auth account, not for approval
 * itself (that's `decideGrowthPartner`). Reuses the exact same branded
 * reset-link + email-provider path `decideGrowthPartner` uses on approve, so
 * there is no second onboarding-email mechanism to maintain. Never sends a
 * plaintext password — `generateBrandedResetLink` always mints a fresh,
 * single-use, ~1h-expiry Firebase reset link (Doc 10 §1).
 */
export async function resendGrowthPartnerAccessEmail(
  partnerId: string,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  // Same permission as provisioning the account in the first place — this
  // action re-triggers portal-access delivery, not a lesser capability.
  if (!can(session.role, 'growthPartners:approve')) return permissionError();

  const db = adminDb();
  const ref = db.collection('growthPartners').doc(partnerId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('deletedAt') !== null) {
    return notFoundError('Growth Partner not found.');
  }
  const status = snap.get('status') as string;
  const authUid = snap.get('authUid') as string | null;
  if (status !== 'active' || !authUid) {
    return conflictError('This partner does not have a portal account yet. Approve them first.');
  }

  const verdict = await consumeRateLimit({
    scope: 'growthPartnerResendEmail',
    identifier: partnerId,
    limit: PER_PARTNER_PER_HOUR,
    windowMs: HOUR_MS,
  });
  if (!verdict.allowed) {
    return rateLimitedError('Too many resend attempts for this partner. Please try again later.');
  }

  const displayName = snap.get('displayName') as string;
  const email = snap.get('email') as string;

  const origin = await appOrigin();
  const branding = await getBrandingSettings();
  const brandedLink = await generateBrandedResetLink(email, origin);
  if (!brandedLink) {
    await ref
      .update({
        emailSent: false,
        emailSentAt: new Date(),
        emailStatus: 'skipped',
        emailError: null,
      })
      .catch(() => undefined);
    return internalError('Could not generate a portal access link. Please try again.');
  }

  const bodyText =
    `${displayName}, here is a fresh link to set up your Growth Partner portal access.\n\n` +
    'Set your password to sign in to the partner portal.';
  const outcome = await getEmailProvider().send({
    to: email,
    subject: 'Your TerraNext Growth Partner Portal Access',
    body: [
      bodyText,
      '',
      `Set your password: ${brandedLink}`,
      '',
      'This link expires in 1 hour and can only be used once.',
    ].join('\n'),
    html: renderBrandedEmailHtml({
      heading: 'Your Growth Partner Portal Access',
      preheader: 'A fresh portal access link is ready.',
      bodyText,
      cta: { label: 'Set your password', url: brandedLink },
      footerNote: 'This link expires in 1 hour and can only be used once.',
      appOrigin: origin,
      logoUrl: branding.emailLogoUrl || undefined,
    }),
  });

  await ref
    .update({
      emailSent: outcome.status === 'sent',
      emailSentAt: new Date(),
      emailStatus: outcome.status === 'sent' ? 'sent' : 'failed',
      emailError: outcome.status === 'sent' ? null : outcome.reason,
    })
    .catch(() => undefined);

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'update',
    entityType: 'growth_partner',
    entityId: partnerId,
    entityPath: `growthPartners/${partnerId}`,
    context: { feature: 'growth-partners' },
  });

  if (outcome.status === 'failed') {
    return internalError('The access email could not be sent. Please try again.');
  }
  return ok({ ok: true });
}
