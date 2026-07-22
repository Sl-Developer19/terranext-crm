/**
 * Organisation identity used in outbound communications.
 *
 * Single source of truth for the sender identity and public contact number.
 * These appear in message footers, Reply-To headers and SMS metadata, so a
 * literal copied into each template would guarantee they drift apart — a
 * customer replying to a stale address is a lost enquiry (BR-07).
 *
 * Overridable by environment so a staging deploy can send from a sandbox
 * address without pretending to be the live business.
 */

export const ORGANISATION = {
  /** Display name on outbound email. */
  senderName: process.env.EMAIL_FROM_NAME ?? 'TerraNext Global Ventures',
  /** Envelope sender. Must be a verified sender on the configured provider. */
  senderEmail: process.env.EMAIL_FROM ?? 'pp@terranextglobal.com',
  /**
   * Where replies go. Defaults to the sender — set separately when the
   * sending address is a no-reply that nobody monitors.
   */
  replyTo: process.env.EMAIL_REPLY_TO ?? process.env.EMAIL_FROM ?? 'pp@terranextglobal.com',
  /** Public contact number, E.164. */
  contactPhone: process.env.ORG_CONTACT_PHONE ?? '+918124360360',
  /** Human-readable form for message bodies. */
  contactPhoneDisplay: process.env.ORG_CONTACT_PHONE_DISPLAY ?? '+91 81243 60360',
} as const;

/** RFC 5322 `From` value, e.g. `TerraNext Global Ventures <pp@terranextglobal.com>`. */
export function senderAddress(): string {
  return `${ORGANISATION.senderName} <${ORGANISATION.senderEmail}>`;
}

/**
 * Footer appended to outbound email. Kept out of the template bodies so a
 * contact-detail change never requires editing every template.
 */
export function emailSignature(): string {
  return [
    '',
    '—',
    ORGANISATION.senderName,
    `Phone: ${ORGANISATION.contactPhoneDisplay}`,
    `Email: ${ORGANISATION.senderEmail}`,
  ].join('\n');
}

/**
 * SMS and WhatsApp identify the sender inline: there is no From display name,
 * and an unattributed message reads as spam. Kept short — segment count is
 * what a long footer actually costs here.
 */
export function smsSignature(): string {
  return `\n— ${ORGANISATION.senderName}, ${ORGANISATION.contactPhoneDisplay}`;
}
