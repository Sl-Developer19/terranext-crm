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
 * Re-sends a Community Partner's portal-access (password-set) email —
 * mirrors `growth-partners/actions/resend-access-email.ts` exactly (ADR-014:
 * same parallel-actor pattern, reuses the same branded reset-link +
 * email-provider path `decideCommunityPartner` uses on approve).
 */
export async function resendCommunityPartnerAccessEmail(
  partnerId: string,
): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  // Reuses the existing `growthPartners:approve` permission — no separate
  // RBAC module for Community Partners (approved architecture).
  if (!can(session.role, 'growthPartners:approve')) return permissionError();

  const db = adminDb();
  const ref = db.collection('communityPartners').doc(partnerId);
  const snap = await ref.get();
  if (!snap.exists || snap.get('deletedAt') !== null) {
    return notFoundError('Community Partner not found.');
  }
  const status = snap.get('status') as string;
  const authUid = snap.get('authUid') as string | null;
  if (status !== 'active' || !authUid) {
    return conflictError('This business does not have a portal account yet. Approve them first.');
  }

  const verdict = await consumeRateLimit({
    scope: 'communityPartnerResendEmail',
    identifier: partnerId,
    limit: PER_PARTNER_PER_HOUR,
    windowMs: HOUR_MS,
  });
  if (!verdict.allowed) {
    return rateLimitedError('Too many resend attempts for this business. Please try again later.');
  }

  const orgName = snap.get('orgName') as string;
  const contactName = snap.get('contactName') as string;
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
    `${contactName}, here is a fresh link to set up ${orgName}'s Community Partner portal access.\n\n` +
    'Set your password to sign in to the partner portal.';
  const outcome = await getEmailProvider().send({
    to: email,
    subject: 'Your TerraNext Community Partner Portal Access',
    body: [
      bodyText,
      '',
      `Set your password: ${brandedLink}`,
      '',
      'This link expires in 1 hour and can only be used once.',
    ].join('\n'),
    html: renderBrandedEmailHtml({
      heading: 'Your Community Partner Portal Access',
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
    entityType: 'community_partner',
    entityId: partnerId,
    entityPath: `communityPartners/${partnerId}`,
    context: { feature: 'community-partners' },
  });

  if (outcome.status === 'failed') {
    return internalError('The access email could not be sent. Please try again.');
  }
  return ok({ ok: true });
}
