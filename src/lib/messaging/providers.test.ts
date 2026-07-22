import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getEmailProvider, getSmsProvider, getWhatsAppProvider } from './providers';

/**
 * Credentials come from the environment and are never defaulted. The
 * behaviour that matters most here is what happens when they are absent: the
 * app must keep serving and the message must stay queued, never crash and
 * never be recorded as sent.
 */

const CREDENTIAL_VARS = [
  'EMAIL_PROVIDER',
  'RESEND_API_KEY',
  'SENDGRID_API_KEY',
  'SMS_PROVIDER',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_FROM',
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of CREDENTIAL_VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of CREDENTIAL_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('with no credentials configured', () => {
  it('falls back to the console provider instead of throwing at selection', () => {
    expect(getEmailProvider().name).toBe('console');
    expect(getSmsProvider().name).toBe('console');
    expect(getWhatsAppProvider().name).toBe('console');
  });

  it('defers rather than failing, so the message stays queued for a retry', async () => {
    const outcome = await getEmailProvider().send({
      to: 'someone@example.com',
      subject: 'Test',
      body: 'Body',
    });
    expect(outcome.status).toBe('deferred');
  });

  it('never reports a message as sent when nothing left the building', async () => {
    // The one outcome the FR-10.3 log must never contain.
    const email = await getEmailProvider().send({ to: 'a@b.com', subject: 's', body: 'b' });
    const sms = await getSmsProvider().send({ to: '+919876543210', body: 'b' });
    expect(email.status).not.toBe('sent');
    expect(sms.status).not.toBe('sent');
  });

  it('explains why it could not send, naming the missing configuration', async () => {
    const outcome = await getSmsProvider().send({ to: '+919876543210', body: 'b' });
    expect(outcome.status).toBe('deferred');
    if (outcome.status === 'deferred') {
      expect(outcome.reason).toContain('SMS_PROVIDER');
    }
  });
});

describe('partial configuration', () => {
  it('does not activate a provider that is named but has no key', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    // No RESEND_API_KEY — activating here would send unauthenticated requests.
    expect(getEmailProvider().name).toBe('console');
  });

  it('does not activate twilio without all three of its values', () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    // Missing auth token and from-number.
    expect(getSmsProvider().name).toBe('console');
  });

  it('activates once the key is present', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_test_key';
    expect(getEmailProvider().name).toBe('resend');
  });

  it('activates whatsapp only when the underlying SMS provider is real', () => {
    process.env.SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_FROM = '+919876543210';
    expect(getWhatsAppProvider().name).toBe('twilio-whatsapp');
  });
});
