import { describe, expect, it } from 'vitest';

import { registerPublicCommunityPartnerSchema } from './public-schema';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    orgName: 'Zenith Fitness Studio',
    businessCategory: 'gym',
    contactName: 'Priya Nair',
    email: 'priya@zenithfitness.example',
    phone: '+919876543210',
    ...overrides,
  };
}

describe('registerPublicCommunityPartnerSchema', () => {
  it('accepts a minimal valid submission', () => {
    expect(registerPublicCommunityPartnerSchema.safeParse(valid()).success).toBe(true);
  });

  it('rejects an unknown business category', () => {
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ businessCategory: 'restaurant' }))
        .success,
    ).toBe(false);
  });

  it('accepts every category from the TCGN brief', () => {
    const categories = [
      'gym',
      'beauty_salon',
      'yoga_centre',
      'dance_academy',
      'tuition_centre',
      'hospital',
      'clinic',
      'cafe',
      'apartment_association',
      'ngo',
      'corporate',
      'other',
    ];
    for (const businessCategory of categories) {
      expect(
        registerPublicCommunityPartnerSchema.safeParse(valid({ businessCategory })).success,
      ).toBe(true);
    }
  });

  it('accepts optional application notes, rejecting past the 1000-char cap', () => {
    expect(
      registerPublicCommunityPartnerSchema.safeParse(
        valid({ applicationNotes: 'Three outlets across the city' }),
      ).success,
    ).toBe(true);
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ applicationNotes: 'x'.repeat(1001) }))
        .success,
    ).toBe(false);
  });

  it('rejects a non-E.164 phone number', () => {
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ phone: '9876543210' })).success,
    ).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ email: 'not-an-email' })).success,
    ).toBe(false);
  });

  it('rejects a business name below the minimum length', () => {
    expect(registerPublicCommunityPartnerSchema.safeParse(valid({ orgName: 'Z' })).success).toBe(
      false,
    );
  });

  it('rejects a contact name below the minimum length', () => {
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ contactName: 'P' })).success,
    ).toBe(false);
  });

  it('rejects unknown fields so a caller cannot smuggle in status, authUid, or humanPartnerId', () => {
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ status: 'active' })).success,
    ).toBe(false);
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ authUid: 'attacker' })).success,
    ).toBe(false);
    expect(
      registerPublicCommunityPartnerSchema.safeParse(valid({ humanPartnerId: 'TCGN-000001' }))
        .success,
    ).toBe(false);
  });

  it('treats an empty honeypot as fine and a filled one as parseable-but-flagged', () => {
    expect(registerPublicCommunityPartnerSchema.safeParse(valid({ hp_field: '' })).success).toBe(
      true,
    );
    expect(registerPublicCommunityPartnerSchema.safeParse(valid({ hp_field: 'bot' })).success).toBe(
      false,
    );
  });
});
