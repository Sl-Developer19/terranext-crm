import { z } from 'zod';

/**
 * Environment contract (scaffold item 11 — environment validation).
 *
 * NEXT_PUBLIC_* values are statically inlined by Next.js, so each variable
 * must be referenced explicitly (never `process.env[key]`). Validation runs
 * on first import of `env`; a misconfigured deployment fails fast with a
 * field-level report instead of failing obscurely at Firebase init.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_USE_EMULATORS: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /**
   * Secret for signing short-lived MFA pending JWTs (Doc 10 §1 TOTP flow).
   * Must be at least 32 characters. Never exposed client-side.
   * Generate with: openssl rand -base64 32
   */
  MFA_TOKEN_SECRET: z.string().min(32, 'MFA_TOKEN_SECRET must be at least 32 characters'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function loadClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_USE_EMULATORS: process.env.NEXT_PUBLIC_USE_EMULATORS,
    MFA_TOKEN_SECRET: process.env.MFA_TOKEN_SECRET,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Invalid environment configuration. Check .env.local against .env.example. Problems: ${missing}`,
    );
  }
  return parsed.data;
}

let cached: ClientEnv | null = null;

/** Lazily validated environment — call sites: lib/firebase only. */
export function env(): ClientEnv {
  cached ??= loadClientEnv();
  return cached;
}
