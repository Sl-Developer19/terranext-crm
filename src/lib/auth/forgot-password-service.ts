import { AUTH_MESSAGES } from '@/lib/auth/messages';
import type { ResetRequestThrottle } from '@/lib/auth/reset-request-throttle';
import { ok, type Result } from '@/lib/utils/result';

/**
 * Password-reset request orchestration (Doc 10 §1 extension). The response
 * is identical whether or not the address has an account, and whether or
 * not the request was throttled — enumeration resistance (approved A3)
 * extended from login to this flow.
 */

export interface ForgotPasswordInput {
  email: string;
  /** Origin of the incoming request — the emailed link points back here, never a hardcoded host. */
  appOrigin: string;
  ip: string;
  userAgent: string;
}

export interface ResetLinkGenerator {
  /** Returns null when no account exists for the email — never surfaced to the caller. */
  generate(email: string): Promise<{ oobCode: string } | null>;
}

export interface ResetEmailSender {
  send(email: string, resetUrl: string): Promise<void>;
}

export interface ForgotPasswordDeps {
  throttle: ResetRequestThrottle;
  linkGenerator: ResetLinkGenerator;
  emailSender: ResetEmailSender;
}

export async function performForgotPassword(
  deps: ForgotPasswordDeps,
  input: ForgotPasswordInput,
): Promise<Result<{ message: string }>> {
  const shouldSend = await deps.throttle.shouldSend(input.email);
  if (shouldSend) {
    const link = await deps.linkGenerator.generate(input.email);
    if (link) {
      const resetUrl = `${input.appOrigin}/reset-password?oobCode=${encodeURIComponent(link.oobCode)}`;
      await deps.emailSender.send(input.email, resetUrl);
    }
  }

  return ok({ message: AUTH_MESSAGES.resetRequested });
}
