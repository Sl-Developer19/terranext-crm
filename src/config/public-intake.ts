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

const DEFAULT_ORIGINS = [
  'https://terranextglobal.com',
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
