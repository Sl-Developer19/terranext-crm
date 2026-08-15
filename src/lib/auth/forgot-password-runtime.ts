import 'server-only';

import { emailSignature } from '@/config/organisation';
import { hashEmail } from '@/lib/auth/identity';
import type {
  ForgotPasswordDeps,
  ResetEmailSender,
  ResetLinkGenerator,
} from '@/lib/auth/forgot-password-service';
import { generateBrandedResetLink } from '@/lib/auth/reset-link';
import {
  createResetRequestThrottle,
  type ResetRequestThrottle,
} from '@/lib/auth/reset-request-throttle';
import { FirestoreResetRequestThrottleStore } from '@/lib/auth/reset-request-throttle-firestore';
import { adminDb } from '@/lib/firebase/admin';
import { renderBrandedEmailHtml } from '@/lib/messaging/email-template';
import { getEmailProvider } from '@/lib/messaging/providers';
import { systemClock } from '@/lib/utils/clock';

/** Production wiring for the password-reset request flow (Doc 10 §1 extension). */

const linkGenerator: ResetLinkGenerator = {
  generate: (email, appOrigin) => generateBrandedResetLink(email, appOrigin),
};

function buildEmailSender(emailLogoUrl: string | undefined): ResetEmailSender {
  return {
    async send(email, resetUrl) {
      const bodyText =
        'We received a request to reset your TerraNext Business OS password.\n\n' +
        'If you did not request this, you can ignore this email — your password will not change.';

      // eslint-disable-next-line no-console
      console.log('[email] sending password-reset email to recipient:', email);
      const outcome = await getEmailProvider().send({
        to: email,
        subject: 'Reset your TerraNext Business OS password',
        body: [
          bodyText,
          '',
          `Reset your password: ${resetUrl}`,
          '',
          'This link expires in 1 hour and can only be used once.',
          emailSignature(),
        ].join('\n'),
        html: renderBrandedEmailHtml({
          heading: 'Reset your password',
          preheader: 'Reset your TerraNext Business OS password.',
          bodyText,
          cta: { label: 'Reset your password', url: resetUrl },
          footerNote: 'This link expires in 1 hour and can only be used once.',
          appOrigin: new URL(resetUrl).origin,
          logoUrl: emailLogoUrl,
        }),
      });
      if (outcome.status === 'failed') {
        console.error('Password-reset email failed to send:', outcome.reason);
      }
    },
  };
}

let cachedThrottle: ResetRequestThrottle | null = null;

/**
 * `emailLogoUrl` (Settings §4 `branding.emailLogoUrl`) is supplied fresh by
 * the caller on every request rather than cached here — `lib` may not import
 * `features` (Doc 02 §5), so the route handler reads the setting and passes
 * it through. Only the throttle (stateless w.r.t. branding) is memoized.
 */
export function forgotPasswordServiceDeps(emailLogoUrl?: string): ForgotPasswordDeps {
  cachedThrottle ??= createResetRequestThrottle({
    store: new FirestoreResetRequestThrottleStore(adminDb()),
    clock: systemClock,
    hashEmail,
  });
  return {
    throttle: cachedThrottle,
    linkGenerator,
    emailSender: buildEmailSender(emailLogoUrl),
  };
}
