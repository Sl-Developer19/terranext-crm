import { describe, expect, it } from 'vitest';

import { registerPublicGrowthPartnerSchema } from './public-schema';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    displayName: 'Asha Menon',
    email: 'asha@example.com',
    phone: '+919876543210',
    ...overrides,
  };
}

describe('registerPublicGrowthPartnerSchema', () => {
  it('accepts a minimal valid submission', () => {
    expect(registerPublicGrowthPartnerSchema.safeParse(valid()).success).toBe(true);
  });

  it('accepts an optional organization name', () => {
    expect(
      registerPublicGrowthPartnerSchema.safeParse(valid({ organizationName: 'Acme Corp' })).success,
    ).toBe(true);
  });

  it('rejects a non-E.164 phone number', () => {
    expect(
      registerPublicGrowthPartnerSchema.safeParse(valid({ phone: '9876543210' })).success,
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      registerPublicGrowthPartnerSchema.safeParse(valid({ email: 'not-an-email' })).success,
    ).toBe(false);
  });

  it('rejects a name below the minimum length', () => {
    expect(registerPublicGrowthPartnerSchema.safeParse(valid({ displayName: 'A' })).success).toBe(
      false,
    );
  });

  it('rejects unknown fields so a caller cannot smuggle in status or authUid', () => {
    expect(registerPublicGrowthPartnerSchema.safeParse(valid({ status: 'active' })).success).toBe(
      false,
    );
    expect(
      registerPublicGrowthPartnerSchema.safeParse(valid({ authUid: 'attacker' })).success,
    ).toBe(false);
  });

  it('treats an empty honeypot as fine and a filled one as parseable-but-flagged', () => {
    expect(registerPublicGrowthPartnerSchema.safeParse(valid({ hp_field: '' })).success).toBe(true);
    expect(registerPublicGrowthPartnerSchema.safeParse(valid({ hp_field: 'bot' })).success).toBe(
      false,
    );
  });
});
