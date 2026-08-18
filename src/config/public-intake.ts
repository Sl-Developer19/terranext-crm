/**
 * Public intake configuration (Doc 20 §2).
 *
 * Origins are configuration, not code: the marketing site's hostname changes
 * with environment (local, preview, production) and must be changeable without
 * a CRM release. `PUBLIC_INTAKE_ORIGINS` is a comma-separated env var.
 */

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const PRIMARY_ORIGIN = 'https://terranextglobal.com';

const DEFAULT_ORIGINS = [
  PRIMARY_ORIGIN,
  'https://www.terranextglobal.com',
  // Local website development against a local CRM.
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : []),
];

export const PUBLIC_INTAKE = {
  allowedOrigins: (() => {
    const configured = parseOrigins(process.env.PUBLIC_INTAKE_ORIGINS);
    return configured.length > 0 ? configured : DEFAULT_ORIGINS;
  })(),
} as const;

/**
 * Where the CRM redirects a QR scan to (TCGN referral flow) — the opposite
 * direction from `PUBLIC_INTAKE.allowedOrigins` above (which validates
 * *incoming* calls from the website). Same env-var-with-fallback shape,
 * deliberately: one configuration idiom for "the public website's address,"
 * not two.
 */
export const PUBLIC_SITE_ORIGIN = (process.env.PUBLIC_SITE_ORIGIN ?? PRIMARY_ORIGIN).replace(
  /\/$/,
  '',
);
