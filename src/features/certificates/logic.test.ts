import { describe, expect, it } from 'vitest';

import {
  buildCertificateVerifyUrl,
  canRevoke,
  evaluateEligibility,
  formatCertificateNo,
  isVerificationSafe,
} from './logic';

const PASSING = {
  attendanceStatuses: ['present', 'present', 'present', 'present'] as const,
  attempts: [{ score: 80, maxScore: 100, result: 'pass' as const }],
  minAttendancePct: 75,
  minAssessmentScore: 40,
};

describe('evaluateEligibility (BR-03, condition C-2)', () => {
  it('issues when both criteria are met', () => {
    const verdict = evaluateEligibility(PASSING);
    expect(verdict.eligible).toBe(true);
    expect(verdict.blockers).toEqual([]);
    expect(verdict.attendancePct).toBe(100);
    expect(verdict.assessmentAvgScore).toBe(80);
  });

  it('blocks on attendance alone and says so specifically', () => {
    const verdict = evaluateEligibility({
      ...PASSING,
      attendanceStatuses: ['present', 'absent', 'absent', 'absent'],
    });
    expect(verdict.eligible).toBe(false);
    expect(verdict.blockers).toHaveLength(1);
    expect(verdict.blockers[0]).toContain('Attendance is 25%');
    expect(verdict.blockers[0]).toContain('required 75%');
  });

  it('blocks on assessment alone and says so specifically', () => {
    const verdict = evaluateEligibility({
      ...PASSING,
      attempts: [{ score: 20, maxScore: 100, result: 'fail' }],
    });
    expect(verdict.eligible).toBe(false);
    expect(verdict.blockers).toHaveLength(1);
    expect(verdict.blockers[0]).toContain('Assessment average is 20');
  });

  it('reports BOTH blockers when both criteria fail', () => {
    const verdict = evaluateEligibility({
      ...PASSING,
      attendanceStatuses: ['absent', 'absent'],
      attempts: [{ score: 10, maxScore: 100, result: 'fail' }],
    });
    expect(verdict.eligible).toBe(false);
    expect(verdict.blockers).toHaveLength(2);
  });

  it('NEVER issues to an unassessed participant, even with perfect attendance', () => {
    const verdict = evaluateEligibility({ ...PASSING, attempts: [] });
    expect(verdict.eligible).toBe(false);
    expect(verdict.blockers[0]).toContain('No assessment has been recorded');
  });

  it('never issues to a participant with no attendance marks at all', () => {
    const verdict = evaluateEligibility({ ...PASSING, attendanceStatuses: [] });
    expect(verdict.eligible).toBe(false);
    expect(verdict.attendancePct).toBe(0);
  });

  it('is exactly-at-threshold inclusive on both criteria', () => {
    const verdict = evaluateEligibility({
      attendanceStatuses: ['present', 'present', 'present', 'absent'], // 75%
      attempts: [{ score: 40, maxScore: 100, result: 'pass' }], // 40
      minAttendancePct: 75,
      minAssessmentScore: 40,
    });
    expect(verdict.eligible).toBe(true);
  });

  it('C-2: the verdict follows RAW evidence, not any stale roll-up', () => {
    // The scenario condition C-2 exists for: a participant whose stored
    // attendancePct says 100 but whose actual marks say otherwise. Only raw
    // evidence is passed in, so the verdict is necessarily the honest one.
    const verdict = evaluateEligibility({
      ...PASSING,
      attendanceStatuses: ['absent', 'absent', 'absent', 'absent'],
    });
    expect(verdict.eligible).toBe(false);
    expect(verdict.attendancePct).toBe(0);
  });

  it('excused sessions neither help nor hurt eligibility', () => {
    const verdict = evaluateEligibility({
      ...PASSING,
      attendanceStatuses: ['present', 'present', 'present', 'excused'],
    });
    // 3 of 3 counted = 100%, the excused is ignored entirely.
    expect(verdict.attendancePct).toBe(100);
    expect(verdict.eligible).toBe(true);
  });
});

describe('formatCertificateNo (Doc 14 §3)', () => {
  it('zero-pads to five digits', () => {
    expect(formatCertificateNo('TNXC', 2026, 107)).toBe('TNXC-2026-00107');
  });

  it('does not truncate a sequence beyond the padding', () => {
    expect(formatCertificateNo('TNXC', 2026, 1234567)).toBe('TNXC-2026-1234567');
  });
});

describe('canRevoke', () => {
  it('allows revoking an issued certificate', () => {
    expect(canRevoke('issued')).toBe(true);
  });

  it('refuses to revoke an already-revoked certificate', () => {
    expect(canRevoke('revoked')).toBe(false);
  });
});

describe('isVerificationSafe (public endpoint carries no PII)', () => {
  it('accepts programme and issuance fields', () => {
    expect(isVerificationSafe(['certificateNo', 'programmeName', 'issuedAt', 'status'])).toBe(true);
  });

  it('rejects any participant-identifying field', () => {
    expect(isVerificationSafe(['certificateNo', 'participantName'])).toBe(false);
    expect(isVerificationSafe(['participantId'])).toBe(false);
    expect(isVerificationSafe(['programmeName', 'phone'])).toBe(false);
  });
});

describe('buildCertificateVerifyUrl (Certificate Template Engine QR target)', () => {
  it('points at the CRM origin’s own /verify page with number and hash as query params', () => {
    const url = buildCertificateVerifyUrl(
      'https://crm.terranext.example',
      'TNXC-2026-00107',
      'abc123',
    );
    expect(url).toBe('https://crm.terranext.example/verify?no=TNXC-2026-00107&hash=abc123');
  });

  it('strips a trailing slash from the origin', () => {
    const url = buildCertificateVerifyUrl(
      'https://crm.terranext.example/',
      'TNXC-2026-00001',
      'hash',
    );
    expect(url).toBe('https://crm.terranext.example/verify?no=TNXC-2026-00001&hash=hash');
  });

  it('URL-encodes special characters in either parameter', () => {
    const url = buildCertificateVerifyUrl('https://crm.terranext.example', 'TNXC 2026', 'a&b');
    expect(url).toContain('no=TNXC+2026');
    expect(url).toContain('hash=a%26b');
  });
});
