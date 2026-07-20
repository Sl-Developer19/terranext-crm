import { z } from 'zod';

/** Login form domain schema — framework-free (Doc 02 §3). */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Idle-timeout re-auth schema (M1-B) — password only, no email field (the
 * session's own email is shown read-only and never re-submitted by the client). */
export const reauthSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type ReauthInput = z.infer<typeof reauthSchema>;
