/** Bounded retry with linear backoff for transient provider failures (a
 * network blip, a momentary 5xx) — absorbs the common case automatically so
 * a session doesn't land in the Processing Queue's failed state, and a human
 * doesn't have to click Retry, for something that would have succeeded on
 * the next attempt. Still fails the job (and stays manually retryable) once
 * these attempts are exhausted. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
  throw lastError;
}
