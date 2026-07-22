import 'server-only';

import { ORGANISATION, senderAddress } from '@/config/organisation';

import {
  outcomeForStatus,
  type EmailMessage,
  type EmailProvider,
  type SendOutcome,
  type SmsMessage,
  type SmsProvider,
} from './types';

/**
 * Concrete providers, selected by environment (Doc 12 §5 keeps vendor choice
 * a configuration decision, not an architectural one).
 *
 * All of them use `fetch` against the vendor REST API rather than an SDK: no
 * extra dependency, no vendor code in the bundle, and the failure surface is
 * a plain HTTP status we already know how to classify.
 */

const TIMEOUT_MS = 10_000;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<SendOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const detail = response.ok ? '' : `${response.status} ${await response.text().catch(() => '')}`;
    return outcomeForStatus(response.status, detail.slice(0, 300));
  } catch (error) {
    // A timeout or DNS failure is transient by nature — deferred, not failed,
    // so a provider outage does not permanently mark a batch of messages dead.
    const reason = error instanceof Error ? error.message : 'network error';
    return { status: 'deferred', reason: reason.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The provider used when none is configured. It records the attempt and
 * reports `deferred`, never `sent` — claiming a message was sent when nothing
 * left the building is the one outcome the log must never contain.
 */
const consoleEmailProvider: EmailProvider = {
  name: 'console',
  async send(): Promise<SendOutcome> {
    return { status: 'deferred', reason: 'No email provider configured (EMAIL_PROVIDER unset).' };
  },
};

const consoleSmsProvider: SmsProvider = {
  name: 'console',
  async send(): Promise<SendOutcome> {
    return { status: 'deferred', reason: 'No SMS provider configured (SMS_PROVIDER unset).' };
  },
};

function resendProvider(apiKey: string): EmailProvider {
  return {
    name: 'resend',
    send: (message: EmailMessage) =>
      postJson(
        'https://api.resend.com/emails',
        { Authorization: `Bearer ${apiKey}` },
        {
          from: senderAddress(),
          to: [message.to],
          reply_to: ORGANISATION.replyTo,
          subject: message.subject,
          text: message.body,
        },
      ),
  };
}

function sendgridProvider(apiKey: string): EmailProvider {
  return {
    name: 'sendgrid',
    send: (message: EmailMessage) =>
      postJson(
        'https://api.sendgrid.com/v3/mail/send',
        { Authorization: `Bearer ${apiKey}` },
        {
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: ORGANISATION.senderEmail, name: ORGANISATION.senderName },
          reply_to: { email: ORGANISATION.replyTo },
          subject: message.subject,
          content: [{ type: 'text/plain', value: message.body }],
        },
      ),
  };
}

function twilioProvider(accountSid: string, authToken: string, from: string): SmsProvider {
  return {
    name: 'twilio',
    async send(message: SmsMessage): Promise<SendOutcome> {
      // Twilio's API is form-encoded, not JSON — the one vendor here that
      // does not fit `postJson`.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: message.to, From: from, Body: message.body }),
            signal: controller.signal,
          },
        );
        const detail = response.ok
          ? ''
          : `${response.status} ${await response.text().catch(() => '')}`;
        return outcomeForStatus(response.status, detail.slice(0, 300));
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'network error';
        return { status: 'deferred', reason: reason.slice(0, 300) };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER;

  // The sender identity has a sensible default (config/organisation.ts), so
  // only the API key is a hard requirement — credentials come from the
  // environment and are never defaulted, since a wrong key fails loudly but a
  // wrong *sender* would silently send as the wrong business.
  if (provider === 'resend' && process.env.RESEND_API_KEY) {
    return resendProvider(process.env.RESEND_API_KEY);
  }
  if (provider === 'sendgrid' && process.env.SENDGRID_API_KEY) {
    return sendgridProvider(process.env.SENDGRID_API_KEY);
  }
  // Misconfiguration degrades to the console provider rather than throwing at
  // module load, which would take the whole app down over an unset env var.
  return consoleEmailProvider;
}

export function getSmsProvider(): SmsProvider {
  if (
    process.env.SMS_PROVIDER === 'twilio' &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  ) {
    return twilioProvider(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
      process.env.TWILIO_FROM,
    );
  }
  return consoleSmsProvider;
}

/** WhatsApp rides Twilio's messaging API with a `whatsapp:` address prefix. */
export function getWhatsAppProvider(): SmsProvider {
  const base = getSmsProvider();
  if (base.name === 'console') return base;
  return {
    name: `${base.name}-whatsapp`,
    send: (message) => base.send({ ...message, to: `whatsapp:${message.to}` }),
  };
}
