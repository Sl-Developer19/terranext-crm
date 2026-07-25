import 'server-only';

import { emailSignature } from '@/config/organisation';
import { hashEmail } from '@/lib/auth/identity';
import type {
  ForgotPasswordDeps,
  ResetEmailSender,
  ResetLinkGenerator,
} from '@/lib/auth/forgot-password-service';
import { generateBrandedResetLink } from '@/lib/auth/reset-link';
import { createResetRequestThrottle } from '@/lib/auth/reset-request-throttle';
import { FirestoreResetRequestThrottleStore } from '@/lib/auth/reset-request-throttle-firestore';
import { adminDb } from '@/lib/firebase/admin';
import { renderBrandedEmailHtml } from '@/lib/messaging/email-template';
import { getEmailProvider } from '@/lib/messaging/providers';
import { systemClock } from '@/lib/utils/clock';

/** Production wiring for the password-reset request flow (Doc 10 §1 extension). */

const linkGenerator: ResetLinkGenerator = {
  generate: (email, appOrigin) => generateBrandedResetLink(email, appOrigin),
};

const emailSender: ResetEmailSender = {
  async send(email, resetUrl) {
    const bodyText =
      'We received a request to reset your TerraNext Business OS password.\n\n' +
      'If you did not request this, you can ignore this email — your password will not change.';

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
      }),
    });
    if (outcome.status === 'failed') {
      console.error('Password-reset email failed to send:', outcome.reason);
    }
  },
};

let cached: ForgotPasswordDeps | null = null;

export function forgotPasswordServiceDeps(): ForgotPasswordDeps {
  cached ??= {
    throttle: createResetRequestThrottle({
      store: new FirestoreResetRequestThrottleStore(adminDb()),
      clock: systemClock,
      hashEmail,
    }),
    linkGenerator,
    emailSender,
  };
  return cached;
}
