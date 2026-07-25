/**
 * Message provider abstraction (FR-10.3).
 *
 * The CRM never talks to a vendor SDK directly. Two reasons this matters
 * beyond tidiness: the communications log must record an attempt whether or
 * not a vendor is configured, and swapping vendors (or running with none at
 * all in development) must not touch feature code.
 *
 * Providers report outcomes rather than throwing. A send that failed is a
 * business fact the log must carry, not an exception that unwinds the worker.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  /** Optional branded HTML alternative — providers that support it send a multipart message; `body` remains the plain-text fallback. */
  html?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
}

export type SendOutcome =
  | { status: 'sent'; providerMessageId: string | null }
  /** The provider rejected it and retrying will not help (bad address, blocked). */
  | { status: 'failed'; reason: string }
  /** Transient — the worker may retry this one on a later pass. */
  | { status: 'deferred'; reason: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendOutcome>;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SendOutcome>;
}

/**
 * HTTP status → outcome. 4xx is the provider telling us the request itself is
 * wrong, so a retry sends the identical bad request again; 429 and 5xx are the
 * provider asking us to come back later.
 */
export function outcomeForStatus(status: number, detail: string): SendOutcome {
  if (status >= 200 && status < 300) return { status: 'sent', providerMessageId: null };
  if (status === 429 || status >= 500) return { status: 'deferred', reason: detail };
  return { status: 'failed', reason: detail };
}
