import { describe, expect, it } from 'vitest';

import { createPublicLeadSchema } from './public-schema';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    formType: 'general',
    leadType: 'student',
    name: 'Asha Menon',
    phone: '+919876543210',
    email: 'asha@example.com',
    consent: { given: true, textVersion: 'v1' },
    ...overrides,
  };
}

describe('createPublicLeadSchema', () => {
  it('accepts a minimal valid submission', () => {
    const result = createPublicLeadSchema.safeParse(valid());
    expect(result.success).toBe(true);
  });

  it('defaults email and programme interest to null rather than undefined', () => {
    const result = createPublicLeadSchema.parse({
      formType: 'general',
      leadType: 'student',
      name: 'Asha Menon',
      phone: '+919876543210',
      consent: { given: true, textVersion: 'v1' },
    });
    expect(result.email).toBeNull();
    expect(result.programmeInterestSlug).toBeNull();
  });

  it('rejects an unknown lead type', () => {
    expect(createPublicLeadSchema.safeParse(valid({ leadType: 'business' })).success).toBe(false);
  });

  it('rejects a submission missing lead type', () => {
    expect(createPublicLeadSchema.safeParse(valid({ leadType: undefined })).success).toBe(false);
  });

  it('accepts every lead type in the contract', () => {
    for (const leadType of ['student', 'parent', 'corporate', 'institution', 'other']) {
      expect(createPublicLeadSchema.safeParse(valid({ leadType })).success).toBe(true);
    }
  });

  it('rejects a submission without consent', () => {
    expect(createPublicLeadSchema.safeParse(valid({ consent: undefined })).success).toBe(false);
  });

  it('rejects consent that is explicitly withheld', () => {
    // `given` is a literal true — false must not parse into a lead we would
    // then be unable to lawfully contact.
    const result = createPublicLeadSchema.safeParse(
      valid({ consent: { given: false, textVersion: 'v1' } }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a non-E.164 phone number', () => {
    expect(createPublicLeadSchema.safeParse(valid({ phone: '9876543210' })).success).toBe(false);
    expect(createPublicLeadSchema.safeParse(valid({ phone: '+0123456789' })).success).toBe(false);
  });

  it('rejects unknown form types', () => {
    expect(createPublicLeadSchema.safeParse(valid({ formType: 'spam' })).success).toBe(false);
  });

  it('rejects unknown fields so a caller cannot smuggle in an actor or stage', () => {
    expect(createPublicLeadSchema.safeParse(valid({ stage: 'admitted' })).success).toBe(false);
    expect(createPublicLeadSchema.safeParse(valid({ createdBy: 'attacker' })).success).toBe(false);
  });

  it('treats an empty honeypot as fine and a filled one as parseable-but-flagged', () => {
    expect(createPublicLeadSchema.safeParse(valid({ hp_field: '' })).success).toBe(true);
    // A filled honeypot fails max(0) — the service also drops it silently.
    expect(createPublicLeadSchema.safeParse(valid({ hp_field: 'bot' })).success).toBe(false);
  });

  it('accepts partial UTM data', () => {
    const result = createPublicLeadSchema.safeParse(valid({ utm: { source: 'google' } }));
    expect(result.success).toBe(true);
  });

  it('enforces the name and message length bounds', () => {
    expect(createPublicLeadSchema.safeParse(valid({ name: 'A' })).success).toBe(false);
    expect(createPublicLeadSchema.safeParse(valid({ message: 'x'.repeat(1001) })).success).toBe(
      false,
    );
  });
});
