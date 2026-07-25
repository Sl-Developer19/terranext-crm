import 'server-only';

import { emailSignature } from '@/config/organisation';
import { hashEmail } from '@/lib/auth/identity';
import type {
  ForgotPasswordDeps,
  ResetEmailSender,
  ResetLinkGenerator,
} from '@/lib/auth/forgot-password-service';
import { createResetRequestThrottle } from '@/lib/auth/reset-request-throttle';
import { FirestoreResetRequestThrottleStore } from '@/lib/auth/reset-request-throttle-firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getEmailProvider } from '@/lib/messaging/providers';
import { systemClock } from '@/lib/utils/clock';

/** Production wiring for the password-reset request flow (Doc 10 §1 extension). */

const linkGenerator: ResetLinkGenerator = {
  async generate(email) {
    let link: string;
    try {
      // Admin SDK, not the public REST sendOobCode: this returns the link
      // without sending Firebase's own hosted email, so we can send our own
      // branded one instead and point it at our /reset-password page.
      link = await adminAuth().generatePasswordResetLink(email);
    } catch (error) {
      // "no account for this email" is the expected shape of most calls
      // here — the caller already treats a null result as "do nothing" so
      // enumeration resistance holds either way. Anything else is logged
      // for ops but still yields no email.
      if ((error as { code?: string }).code !== 'auth/user-not-found') {
        console.error('generatePasswordResetLink failed', error);
      }
      return null;
    }
    const oobCode = new URL(link).searchParams.get('oobCode');
    return oobCode ? { oobCode } : null;
  },
};

const emailSender: ResetEmailSender = {
  async send(email, resetUrl) {
    const outcome = await getEmailProvider().send({
      to: email,
      subject: 'Reset your TerraNext Business OS password',
      body: [
        'We received a request to reset your TerraNext Business OS password.',
        '',
        `Reset your password: ${resetUrl}`,
        '',
        'This link expires in 1 hour and can only be used once. If you did ' +
          'not request this, you can ignore this email — your password will not change.',
        emailSignature(),
      ].join('\n'),
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
