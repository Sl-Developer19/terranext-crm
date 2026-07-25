import { describe, expect, it } from 'vitest';

import {
  performForgotPassword,
  type ForgotPasswordDeps,
  type ForgotPasswordInput,
} from '@/lib/auth/forgot-password-service';
import { AUTH_MESSAGES } from '@/lib/auth/messages';

const INPUT: ForgotPasswordInput = {
  email: 'founder@terranext.in',
  appOrigin: 'https://crm.terranextglobal.com',
  ip: '203.0.113.7',
  userAgent: 'vitest',
};

function harness(options?: { shouldSend?: boolean; link?: { oobCode: string } | null }) {
  const sent: Array<{ email: string; resetUrl: string }> = [];
  const link = options && 'link' in options ? options.link : { oobCode: 'code-1' };
  const deps: ForgotPasswordDeps = {
    throttle: { shouldSend: () => Promise.resolve(options?.shouldSend ?? true) },
    linkGenerator: { generate: () => Promise.resolve(link) },
    emailSender: {
      send: (email, resetUrl) => {
        sent.push({ email, resetUrl });
        return Promise.resolve();
      },
    },
  };
  return { deps, sent };
}

describe('performForgotPassword (Doc 10 §1 extension)', () => {
  it('sends a reset email with a link back to the requesting origin', async () => {
    const { deps, sent } = harness();
    const result = await performForgotPassword(deps, INPUT);

    expect(result.ok).toBe(true);
    expect(sent).toEqual([
      {
        email: INPUT.email,
        resetUrl: 'https://crm.terranextglobal.com/reset-password?oobCode=code-1',
      },
    ]);
  });

  it('returns the generic message even when an account does not exist', async () => {
    const { deps, sent } = harness({ link: null });
    const result = await performForgotPassword(deps, INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.message).toBe(AUTH_MESSAGES.resetRequested);
    expect(sent).toEqual([]);
  });

  it('returns the same generic response when throttled, without sending', async () => {
    const { deps, sent } = harness({ shouldSend: false });
    const result = await performForgotPassword(deps, INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.message).toBe(AUTH_MESSAGES.resetRequested);
    expect(sent).toEqual([]);
  });

  it('never varies its response shape between an existing and non-existing account', async () => {
    const existing = await performForgotPassword(
      harness({ link: { oobCode: 'code-1' } }).deps,
      INPUT,
    );
    const missing = await performForgotPassword(harness({ link: null }).deps, INPUT);

    expect(existing).toEqual(missing);
  });
});
