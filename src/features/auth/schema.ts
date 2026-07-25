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

/** Password-reset request schema (Doc 10 §1 extension). */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

const NEW_PASSWORD_RULE = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');

/** Password-reset confirmation schema (Doc 10 §1 extension). `oobCode` comes
 * from the emailed link's query string, never typed by the user. */
export const resetPasswordSchema = z
  .object({
    oobCode: z.string().min(1, 'Reset link is missing or invalid'),
    newPassword: NEW_PASSWORD_RULE,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
