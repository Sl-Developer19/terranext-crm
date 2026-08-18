import { describe, expect, it } from 'vitest';

import { academySchema, programmeSchema } from './schema';

const baseAcademy = {
  name: 'NextGen Transformation Academy',
  slug: 'nextgen-transformation',
  description: '',
  displayOrder: 0,
  icon: '',
  themeColor: '',
};

const baseProgramme = {
  academyId: 'academy-1',
  name: 'The 30-Day Transformation Journey',
  code: 'NGT-30',
  durationDays: 30,
  sessionCount: 20,
  eligibility: '',
  curriculumSummary: '',
  minAttendancePct: 75,
  minAssessmentScore: 40,
  certificateEnabled: true,
  totalFeePaise: 0,
  currency: 'INR',
  intakeStatus: 'open' as const,
  installments: [],
};

describe('academySchema — displayOrder/icon/themeColor', () => {
  it('accepts a fully populated academy', () => {
    const result = academySchema.safeParse({
      ...baseAcademy,
      icon: 'graduation-cap',
      themeColor: '#0D6B4E',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an academy with no icon/colour set (both optional)', () => {
    expect(academySchema.safeParse(baseAcademy).success).toBe(true);
  });

  it('rejects a negative display order', () => {
    const result = academySchema.safeParse({ ...baseAcademy, displayOrder: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer display order', () => {
    const result = academySchema.safeParse({ ...baseAcademy, displayOrder: 1.5 });
    expect(result.success).toBe(false);
  });

  it.each(['0D6B4E', '#0D6B4', '#GGGGGG', 'red'])(
    'rejects a malformed theme colour: %s',
    (themeColor) => {
      const result = academySchema.safeParse({ ...baseAcademy, themeColor });
      expect(result.success).toBe(false);
    },
  );

  it('accepts a valid 6-digit hex theme colour', () => {
    expect(academySchema.safeParse({ ...baseAcademy, themeColor: '#0d6b4e' }).success).toBe(true);
  });
});

describe('programmeSchema — currency/intakeStatus/capacity/certificateEnabled', () => {
  it('accepts a fully populated programme', () => {
    expect(programmeSchema.safeParse({ ...baseProgramme, capacity: 30 }).success).toBe(true);
  });

  it('accepts a programme with no capacity set (optional, not an enforced cap)', () => {
    expect(programmeSchema.safeParse(baseProgramme).success).toBe(true);
  });

  it('lower-cases input is normalised to uppercase for currency', () => {
    const result = programmeSchema.safeParse({ ...baseProgramme, currency: 'inr' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.currency).toBe('INR');
  });

  it.each(['IN', 'INRR', '123', ''])('rejects a malformed currency code: %s', (currency) => {
    expect(programmeSchema.safeParse({ ...baseProgramme, currency }).success).toBe(false);
  });

  it.each(['open', 'closed', 'waitlist'])('accepts intake status: %s', (intakeStatus) => {
    expect(programmeSchema.safeParse({ ...baseProgramme, intakeStatus }).success).toBe(true);
  });

  it('rejects an unrecognised intake status', () => {
    const result = programmeSchema.safeParse({ ...baseProgramme, intakeStatus: 'pending' });
    expect(result.success).toBe(false);
  });

  it('requires certificateEnabled to be present (not optional)', () => {
    const { certificateEnabled: _omit, ...withoutFlag } = baseProgramme;
    expect(programmeSchema.safeParse(withoutFlag).success).toBe(false);
  });

  it('accepts certificateEnabled: false alongside thresholds — the thresholds are still stored, just not enforced', () => {
    const result = programmeSchema.safeParse({ ...baseProgramme, certificateEnabled: false });
    expect(result.success).toBe(true);
  });

  it('rejects a zero or negative capacity', () => {
    expect(programmeSchema.safeParse({ ...baseProgramme, capacity: 0 }).success).toBe(false);
    expect(programmeSchema.safeParse({ ...baseProgramme, capacity: -5 }).success).toBe(false);
  });
});
