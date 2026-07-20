import { z } from 'zod';

/**
 * Client-error report payload (Doc 23 §3, M1-E). Public, unauthenticated
 * endpoint by necessity (an error can happen before/without a valid
 * session) — every field is length-capped so the endpoint can't be used to
 * push arbitrarily large payloads into Cloud Error Reporting.
 */
export const clientErrorReportSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  stack: z.string().max(8_000).optional(),
  url: z.string().max(2_000).optional(),
  componentStack: z.string().max(4_000).optional(),
});

export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>;
