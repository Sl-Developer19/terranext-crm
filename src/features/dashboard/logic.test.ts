import { describe, expect, it } from 'vitest';

import {
  academicSection,
  acquisitionSection,
  financeSection,
  formatMetricValue,
  outcomesSection,
  rate,
  sectionsForRole,
} from './logic';
import type { DashboardCounts, Metric } from './schema';

const EMPTY: DashboardCounts = {
  leadsTotal: 0,
  leadsAdmitted: 0,
  participantsTotal: 0,
  participantsActive: 0,
  participantsCompleted: 0,
  admissionsThisMonth: 0,
  batchesActive: 0,
  batchesTotal: 0,
  certificatesIssued: 0,
  alumniTotal: 0,
  alumniThisMonth: 0,
  parentSessionsTotal: 0,
  familiesTotal: 0,
  familiesConverted: 0,
  trainersTotal: 0,
  trainersAssigned: 0,
  assessmentsTotal: 0,
  assessmentsScored: 0,
  attendancePctMean: 0,
  attendanceSampleSize: 0,
  revenuePaisePaid: 0,
  revenuePaiseOutstanding: 0,
};

const POPULATED: DashboardCounts = {
  ...EMPTY,
  leadsTotal: 200,
  leadsAdmitted: 50,
  participantsTotal: 50,
  participantsActive: 30,
  participantsCompleted: 15,
  admissionsThisMonth: 7,
  batchesActive: 4,
  batchesTotal: 9,
  certificatesIssued: 12,
  alumniTotal: 12,
  alumniThisMonth: 3,
  parentSessionsTotal: 18,
  familiesTotal: 40,
  familiesConverted: 10,
  trainersTotal: 8,
  trainersAssigned: 5,
  assessmentsTotal: 20,
  assessmentsScored: 14,
  attendancePctMean: 82,
  attendanceSampleSize: 46,
  revenuePaisePaid: 7_500_000,
  revenuePaiseOutstanding: 2_500_000,
};

function find(metrics: Metric[], key: string): Metric {
  const metric = metrics.find((m) => m.key === key);
  if (!metric) throw new Error(`metric ${key} not found`);
  return metric;
}

describe('rate', () => {
  it('computes a whole percentage', () => {
    expect(rate(50, 200)).toBe(25);
  });

  it('returns null for an empty population rather than 0%', () => {
    expect(rate(0, 0)).toBeNull();
  });

  it('returns null for a negative denominator', () => {
    expect(rate(5, -1)).toBeNull();
  });

  it('is 100 when everyone converted', () => {
    expect(rate(8, 8)).toBe(100);
  });
});

describe('empty CRM never reports a rate of 0% as if it were an outcome', () => {
  it('marks enquiry→admission unavailable, not 0%', () => {
    const metric = find(acquisitionSection(EMPTY).metrics, 'enquiryToAdmissionRate');
    expect(metric.state).toBe('unavailable');
    if (metric.state === 'unavailable') {
      expect(metric.reason).toContain('No enquiries');
    }
  });

  it('marks programme completion unavailable, not 0%', () => {
    const metric = find(academicSection(EMPTY).metrics, 'programmeCompletionRate');
    expect(metric.state).toBe('unavailable');
  });

  it('marks attendance unavailable when nothing has been marked', () => {
    const metric = find(academicSection(EMPTY).metrics, 'attendancePercentage');
    expect(metric.state).toBe('unavailable');
    if (metric.state === 'unavailable') {
      expect(metric.reason).toContain('No attendance');
    }
  });

  it('marks trainer utilisation unavailable when no trainers exist', () => {
    const metric = find(academicSection(EMPTY).metrics, 'trainerUtilisation');
    expect(metric.state).toBe('unavailable');
  });

  it('still reports genuine counts as 0 — a count of nothing IS zero', () => {
    const metric = find(acquisitionSection(EMPTY).metrics, 'totalEnquiries');
    expect(metric.state).toBe('ok');
    if (metric.state === 'ok') expect(metric.value).toBe(0);
  });
});

describe('metrics with no source module are unavailable, never 0', () => {
  it('reports placement as unavailable and names the missing module', () => {
    const metric = find(outcomesSection(POPULATED).metrics, 'placementStatistics');
    expect(metric.state).toBe('unavailable');
    if (metric.state === 'unavailable') {
      expect(metric.reason).toContain('Module 6');
    }
  });

  it('reports participant satisfaction as unavailable', () => {
    const metric = find(outcomesSection(POPULATED).metrics, 'participantSatisfaction');
    expect(metric.state).toBe('unavailable');
  });

  it('reports operational compliance as unavailable', () => {
    const metric = find(outcomesSection(POPULATED).metrics, 'operationalCompliance');
    expect(metric.state).toBe('unavailable');
  });

  it('flags counselling as partial and says what it excludes', () => {
    const metric = find(acquisitionSection(POPULATED).metrics, 'counsellingAppointments');
    expect(metric.state).toBe('partial');
    if (metric.state === 'partial') {
      expect(metric.value).toBe(18);
      expect(metric.caveat).toContain('participant counselling');
    }
  });
});

describe('populated figures compute correctly', () => {
  it('computes the enquiry→admission conversion rate', () => {
    const metric = find(acquisitionSection(POPULATED).metrics, 'enquiryToAdmissionRate');
    expect(metric.state).toBe('ok');
    if (metric.state === 'ok') expect(metric.value).toBe(25);
  });

  it('computes programme completion against total participants', () => {
    const metric = find(academicSection(POPULATED).metrics, 'programmeCompletionRate');
    if (metric.state === 'ok') expect(metric.value).toBe(30);
  });

  it('computes the collection rate from paid vs paid+outstanding', () => {
    const metric = find(financeSection(POPULATED).metrics, 'revenueSummary');
    // First revenueSummary entry is the collected amount, so search the rate
    // by its percent format.
    const rateMetric = financeSection(POPULATED).metrics.find((m) => m.format === 'percent');
    expect(rateMetric?.state).toBe('ok');
    if (rateMetric?.state === 'ok') expect(rateMetric.value).toBe(75);
    expect(metric.state).toBe('ok');
  });

  it('computes trainer utilisation', () => {
    const metric = find(academicSection(POPULATED).metrics, 'trainerUtilisation');
    if (metric.state === 'ok') expect(metric.value).toBe(63);
  });
});

describe('sectionsForRole (SOP 15.5 access matrix)', () => {
  it('gives the founder the full SOP 18.10 KPI set', () => {
    const titles = sectionsForRole('founder', POPULATED).map((s) => s.title);
    expect(titles).toEqual(['Acquisition', 'Academic delivery', 'Outcomes', 'Finance']);
  });

  it('does not show organisation revenue to a trainer', () => {
    const titles = sectionsForRole('trainer', POPULATED).map((s) => s.title);
    expect(titles).not.toContain('Finance');
    expect(titles).toEqual(['Academic delivery']);
  });

  it('shows finance only its own section', () => {
    expect(sectionsForRole('finance', POPULATED).map((s) => s.title)).toEqual(['Finance']);
  });

  it('shows a consultant acquisition only', () => {
    expect(sectionsForRole('consultant', POPULATED).map((s) => s.title)).toEqual(['Acquisition']);
  });

  it('returns at least one section for every role', () => {
    const roles = [
      'founder',
      'system_admin',
      'ops_manager',
      'consultant',
      'coordinator',
      'trainer',
      'finance',
      'placement',
    ] as const;
    for (const role of roles) {
      expect(sectionsForRole(role, POPULATED).length).toBeGreaterThan(0);
    }
  });
});

describe('formatMetricValue', () => {
  it('renders a dash for unavailable metrics', () => {
    expect(
      formatMetricValue({
        state: 'unavailable',
        key: 'placementStatistics',
        label: 'x',
        format: 'count',
        reason: 'r',
      }),
    ).toBe('—');
  });

  it('renders percentages with a sign', () => {
    expect(
      formatMetricValue({
        state: 'ok',
        key: 'attendancePercentage',
        label: 'x',
        value: 82,
        format: 'percent',
      }),
    ).toBe('82%');
  });

  it('renders paise as whole rupees with Indian grouping', () => {
    expect(
      formatMetricValue({
        state: 'ok',
        key: 'revenueSummary',
        label: 'x',
        value: 7_500_000,
        format: 'currency',
      }),
    ).toBe('₹75,000');
  });

  it('groups large counts', () => {
    expect(
      formatMetricValue({
        state: 'ok',
        key: 'totalEnquiries',
        label: 'x',
        value: 123456,
        format: 'count',
      }),
    ).toBe('1,23,456');
  });
});
