import { describe, expect, it } from 'vitest';

import { brandingSettingsSchema, generalSettingsSchema } from './schema';

const baseGeneral = {
  orgName: 'TerraNext Global Ventures',
  orgTagline: '',
  address: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  gstNumber: '',
  panNumber: '',
  googleMapsUrl: '',
  socialLinks: { facebook: '', instagram: '', linkedin: '', twitter: '', youtube: '' },
};

describe('generalSettingsSchema', () => {
  it('accepts a fully populated organisation record', () => {
    const result = generalSettingsSchema.safeParse({
      ...baseGeneral,
      gstNumber: '22AAAAA0000A1Z5',
      panNumber: 'ABCDE1234F',
      googleMapsUrl: 'https://maps.google.com/?q=TerraNext',
      socialLinks: {
        facebook: 'https://facebook.com/terranext',
        instagram: 'https://instagram.com/terranext',
        linkedin: 'https://linkedin.com/company/terranext',
        twitter: 'https://x.com/terranext',
        youtube: 'https://youtube.com/@terranext',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts all-blank optional business fields', () => {
    expect(generalSettingsSchema.safeParse(baseGeneral).success).toBe(true);
  });

  it('rejects a malformed GST number', () => {
    expect(
      generalSettingsSchema.safeParse({ ...baseGeneral, gstNumber: 'not-a-gst' }).success,
    ).toBe(false);
  });

  it('rejects a malformed PAN number', () => {
    expect(generalSettingsSchema.safeParse({ ...baseGeneral, panNumber: '12345' }).success).toBe(
      false,
    );
  });

  it('rejects a non-URL Google Maps link', () => {
    expect(
      generalSettingsSchema.safeParse({ ...baseGeneral, googleMapsUrl: 'not a url' }).success,
    ).toBe(false);
  });

  it('rejects a non-URL social link', () => {
    expect(
      generalSettingsSchema.safeParse({
        ...baseGeneral,
        socialLinks: { ...baseGeneral.socialLinks, facebook: 'not a url' },
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown social platform key', () => {
    expect(
      generalSettingsSchema.safeParse({
        ...baseGeneral,
        socialLinks: { ...baseGeneral.socialLinks, pinterest: 'https://pinterest.com/terranext' },
      }).success,
    ).toBe(false);
  });
});

const baseBranding = {
  primaryColor: '',
  secondaryColor: '',
  accentColor: '',
  logoUrl: '',
  faviconUrl: '',
  emailLogoUrl: '',
  certificateLogoUrl: '',
  qrLogoUrl: '',
};

describe('brandingSettingsSchema', () => {
  it('accepts a fully populated branding record', () => {
    const result = brandingSettingsSchema.safeParse({
      primaryColor: '#C9A227',
      secondaryColor: '#1F6B4A',
      accentColor: '#050505',
      logoUrl: 'https://cdn.example.com/logo.png',
      faviconUrl: 'https://cdn.example.com/favicon.ico',
      emailLogoUrl: 'https://cdn.example.com/email-logo.png',
      certificateLogoUrl: 'https://cdn.example.com/certificate-logo.png',
      qrLogoUrl: 'https://cdn.example.com/qr-logo.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an all-blank record (unconfigured, falls back to static defaults)', () => {
    expect(brandingSettingsSchema.safeParse(baseBranding).success).toBe(true);
  });

  it.each(['C9A227', '#C9A22', '#GGGGGG'])('rejects a malformed colour: %s', (primaryColor) => {
    expect(brandingSettingsSchema.safeParse({ ...baseBranding, primaryColor }).success).toBe(false);
  });

  it('rejects a non-URL logo', () => {
    expect(
      brandingSettingsSchema.safeParse({ ...baseBranding, logoUrl: 'not a url' }).success,
    ).toBe(false);
  });
});
