import { ORGANISATION } from '@/config/organisation';

/**
 * Branded transactional email layout — Luxury Executive palette (matte black,
 * antique-gold primary, deep-emerald secondary), matching the in-app theme.
 *
 * Table-based and inline-styled on purpose: email clients (Outlook desktop in
 * particular) do not render `<style>` blocks, flexbox/grid, or box-shadow
 * reliably, so this deliberately does not reuse the app's Tailwind tokens.
 * `body`/`bodyText` on `EmailMessage` remains the plain-text fallback for
 * clients that don't render HTML — this module only adds the HTML alternative.
 */

const COLORS = {
  background: '#050505',
  surface: '#0B0F0D',
  border: '#2A2A2A',
  foreground: '#FFFFFF',
  muted: '#8A8A8A',
  body: '#B8B8B8',
  gold: '#C9A227',
  goldForeground: '#050505',
  emerald: '#1F6B4A',
} as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain-text paragraphs (blank-line separated) → escaped `<p>` blocks, single newlines → `<br>`. */
function bodyToHtml(bodyText: string): string {
  return bodyText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');
}

export interface BrandedEmailContent {
  heading: string;
  /** Hidden preview text shown in inbox lists before the email is opened. */
  preheader?: string;
  /** Plain text, paragraphs separated by a blank line. */
  bodyText: string;
  cta?: { label: string; url: string };
  /** Small print below the CTA, e.g. an expiry notice. */
  footerNote?: string;
  /** Origin the logo image is served from — the recipient's mail client fetches it directly. */
  appOrigin: string;
}

export function renderBrandedEmailHtml(content: BrandedEmailContent): string {
  const heading = escapeHtml(content.heading);
  const logoUrl = `${content.appOrigin}/brand/logo.png`;

  const ctaBlock = content.cta
    ? `<tr>
        <td style="padding:24px 32px 0;text-align:center;">
          <a href="${escapeHtml(content.cta.url)}" style="display:inline-block;background-color:${COLORS.gold};color:${COLORS.goldForeground};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:8px;">${escapeHtml(content.cta.label)}</a>
        </td>
      </tr>`
    : '';

  const footerNoteBlock = content.footerNote
    ? `<tr>
        <td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${COLORS.muted};text-align:center;">${escapeHtml(content.footerNote)}</td>
      </tr>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.background};">
    ${content.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:${COLORS.emerald};height:4px;line-height:4px;font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;text-align:center;">
                <img src="${logoUrl}" width="40" height="40" alt="" style="display:inline-block;border-radius:50%;" />
                <div style="margin-top:8px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${COLORS.muted};">TerraNext Global Ventures</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;text-align:center;">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${COLORS.foreground};">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${COLORS.body};">
                ${bodyToHtml(content.bodyText)}
              </td>
            </tr>
            ${ctaBlock}
            ${footerNoteBlock}
            <tr>
              <td style="padding:24px 32px 32px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${COLORS.muted};border-top:1px solid ${COLORS.border};margin-top:24px;">
                <p style="margin:16px 0 4px;">${escapeHtml(ORGANISATION.senderName)}</p>
                <p style="margin:0;">Phone: ${escapeHtml(ORGANISATION.contactPhoneDisplay)} &middot; Email: ${escapeHtml(ORGANISATION.senderEmail)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
