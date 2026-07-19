import { describe, expect, it } from 'vitest';

import {
  ERROR_HTTP_STATUS,
  conflictError,
  ok,
  preconditionError,
  unavailableError,
  unwrapOr,
  validationError,
} from './result';

describe('Result taxonomy', () => {
  it('wraps success values', () => {
    const r = ok({ id: 'TNX-2026-00001' });
    expect(r.ok).toBe(true);
    expect(unwrapOr(r, { id: 'fallback' })).toEqual({ id: 'TNX-2026-00001' });
  });

  it('carries field maps on validation errors', () => {
    const r = validationError<never>({ phone: 'Enter a valid phone number' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('validation');
      expect(r.error.fields).toHaveProperty('phone');
      expect(r.error.retryable).toBe(false);
    }
  });

  it('names the blocking business rule on precondition errors', () => {
    const r = preconditionError<never>('BR-02', 'Counselling outcome required before admission.');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.rule).toBe('BR-02');
      expect(r.error.code).toBe('precondition');
    }
  });

  it('marks only unavailable as retryable', () => {
    const unavailable = unavailableError<never>();
    const conflict = conflictError<never>('Batch is full');
    if (!unavailable.ok) expect(unavailable.error.retryable).toBe(true);
    if (!conflict.ok) expect(conflict.error.retryable).toBe(false);
  });

  it('unwrapOr falls back on failure', () => {
    expect(unwrapOr(conflictError<number>('x'), 42)).toBe(42);
  });

  it('maps every error code to an HTTP status (Doc 20 §4)', () => {
    expect(ERROR_HTTP_STATUS.precondition).toBe(412);
    expect(ERROR_HTTP_STATUS.validation).toBe(422);
    expect(Object.keys(ERROR_HTTP_STATUS)).toHaveLength(7);
  });
});
