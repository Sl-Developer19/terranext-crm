import type { StaffRole } from '@/types/common';

import type { DashboardCounts, DashboardSection, Metric, MetricKey } from './schema';

/**
 * Pure dashboard composition (no I/O).
 *
 * Two rules govern everything here:
 *
 * 1. **A rate with no denominator is not zero, it is undefined.** Dividing by
 *    an empty population yields 0%, which reads as failure. Every rate helper
 *    returns null for an empty denominator and the caller renders "no data
 *    yet" instead.
 * 2. **A metric with no source module is `unavailable`, never `0`.** The SOP
 *    asks for Placement Rate and Participant Satisfaction; neither module
 *    exists. Showing 0% would misreport a gap in the build as a business
 *    result.
 */

/** Whole-percentage rate, or null when the population is empty. */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function ok(
  key: MetricKey,
  label: string,
  value: number,
  format: Metric extends { format: infer F } ? F : never,
  detail?: string,
): Metric {
  return { state: 'ok', key, label, value, format, ...(detail ? { detail } : {}) };
}

function unavailable(key: MetricKey, label: string, reason: string): Metric {
  return { state: 'unavailable', key, label, format: 'count', reason };
}

/**
 * A rate metric: `ok` when there is a population to measure, `unavailable`
 * when there is not. This is the distinction that keeps an empty CRM from
 * reporting 0% completion and 0% conversion as if they were outcomes.
 */
function rateMetric(
  key: MetricKey,
  label: string,
  numerator: number,
  denominator: number,
  emptyReason: string,
  detail?: string,
): Metric {
  const value = rate(numerator, denominator);
  if (value === null) return unavailable(key, label, emptyReason);
  return { state: 'ok', key, label, value, format: 'percent', ...(detail ? { detail } : {}) };
}

/* ── Section builders ──────────────────────────────────────────────────── */

export function acquisitionSection(counts: DashboardCounts): DashboardSection {
  return {
    title: 'Acquisition',
    description: 'Enquiries entering the pipeline and how many become admissions (SOP 15.14).',
    metrics: [
      ok('totalEnquiries', 'Total enquiries', counts.leadsTotal, 'count'),
      // Participant counselling (Module 2) is not built, so this counts only
      // the parent-counselling sessions that do exist. Saying so beats
      // quietly under-reporting a number leadership will act on.
      {
        state: 'partial',
        key: 'counsellingAppointments',
        label: 'Counselling appointments',
        value: counts.parentSessionsTotal,
        format: 'count',
        caveat:
          'Parent counselling only — participant counselling (SOP 15.7 Module 2) is not built.',
      },
      ok('admissions', 'Admissions', counts.participantsTotal, 'count'),
      ok('admissionsThisMonth', 'Admissions this month', counts.admissionsThisMonth, 'count'),
      rateMetric(
        'enquiryToAdmissionRate',
        'Enquiry → admission rate',
        counts.leadsAdmitted,
        counts.leadsTotal,
        'No enquiries recorded yet.',
        `${counts.leadsAdmitted} of ${counts.leadsTotal} enquiries`,
      ),
      rateMetric(
        'parentConversionRate',
        'Parent conversion rate',
        counts.familiesConverted,
        counts.familiesTotal,
        'No family records yet.',
        `${counts.familiesConverted} of ${counts.familiesTotal} households`,
      ),
    ],
  };
}

export function academicSection(counts: DashboardCounts): DashboardSection {
  return {
    title: 'Academic delivery',
    description: 'Active delivery load and how learners are progressing through it.',
    metrics: [
      ok('totalActiveParticipants', 'Active participants', counts.participantsActive, 'count'),
      ok('activeBatches', 'Active batches', counts.batchesActive, 'count'),
      counts.attendanceSampleSize > 0
        ? ok(
            'attendancePercentage',
            'Attendance',
            counts.attendancePctMean,
            'percent',
            `mean across ${counts.attendanceSampleSize} enrolment${counts.attendanceSampleSize === 1 ? '' : 's'} with marks`,
          )
        : unavailable('attendancePercentage', 'Attendance', 'No attendance has been marked yet.'),
      rateMetric(
        'assessmentCompletion',
        'Assessment completion',
        counts.assessmentsScored,
        counts.assessmentsTotal,
        'No assessments created yet.',
        `${counts.assessmentsScored} of ${counts.assessmentsTotal} assessments scored`,
      ),
      rateMetric(
        'programmeCompletionRate',
        'Programme completion rate',
        counts.participantsCompleted,
        counts.participantsTotal,
        'No participants enrolled yet.',
        `${counts.participantsCompleted} of ${counts.participantsTotal} participants`,
      ),
      rateMetric(
        'trainerUtilisation',
        'Trainer utilisation',
        counts.trainersAssigned,
        counts.trainersTotal,
        'No trainers provisioned yet.',
        `${counts.trainersAssigned} of ${counts.trainersTotal} trainers assigned to a live batch`,
      ),
    ],
  };
}

export function outcomesSection(counts: DashboardCounts): DashboardSection {
  return {
    title: 'Outcomes',
    description: 'Certification, placement, and alumni growth (SOP 15.9).',
    metrics: [
      ok('certificatesIssued', 'Certificates issued', counts.certificatesIssued, 'count'),
      ok(
        'alumniGrowth',
        'Alumni',
        counts.alumniTotal,
        'count',
        `${counts.alumniThisMonth} joined this month`,
      ),
      // Module 6 (Career & Placement) has not been built. Reporting 0%
      // placement would read as "nobody got placed" rather than "we do not
      // yet track placements" — a materially different statement to a founder.
      unavailable(
        'placementStatistics',
        'Placement rate',
        'Career & Placement (SOP 15.7 Module 6) is not built — no placement data exists to report.',
      ),
      unavailable(
        'participantSatisfaction',
        'Participant satisfaction',
        'No feedback capture exists yet (SOP 18.10).',
      ),
      unavailable(
        'operationalCompliance',
        'Operational compliance',
        'Requires the Ch.16 document-control registers, which are not built.',
      ),
    ],
  };
}

export function financeSection(counts: DashboardCounts): DashboardSection {
  return {
    title: 'Finance',
    description: 'Collections against what has been billed (SOP 18.9 Finance Dashboard).',
    metrics: [
      ok('revenueSummary', 'Revenue collected', counts.revenuePaisePaid, 'currency'),
      ok('outstandingFees', 'Outstanding fees', counts.revenuePaiseOutstanding, 'currency'),
      rateMetric(
        'revenueSummary',
        'Collection rate',
        counts.revenuePaisePaid,
        counts.revenuePaisePaid + counts.revenuePaiseOutstanding,
        'No fee accounts opened yet.',
      ),
    ],
  };
}

export function growthPartnersSection(counts: DashboardCounts): DashboardSection {
  return {
    title: 'Growth Partners',
    description: 'Referral network reach, conversion, and reward accounting (Doc 25 §6).',
    metrics: [
      ok('gpTotalPartners', 'Growth Partners', counts.gpTotalPartners, 'count'),
      ok(
        'gpActivePartners',
        'Active partners',
        counts.gpActivePartners,
        'count',
        `of ${counts.gpTotalPartners} total`,
      ),
      ok('gpTotalReferrals', 'Referrals', counts.gpTotalReferrals, 'count'),
      rateMetric(
        'gpReferralConversionRate',
        'Referral conversion',
        counts.gpAdmittedReferrals,
        counts.gpTotalReferrals,
        'No referrals recorded yet.',
      ),
      ok(
        'gpRewardsGenerated',
        'Rewards generated',
        counts.gpRewardsAccruedPaise + counts.gpRewardsPaidPaise,
        'currency',
      ),
      ok('gpRewardsPaid', 'Rewards paid', counts.gpRewardsPaidPaise, 'currency'),
      ok('gpPendingRewards', 'Pending rewards', counts.gpRewardsAccruedPaise, 'currency'),
    ],
  };
}

/**
 * Sections a role may see, mirroring the SOP 15.5 access matrix.
 *
 * Deliberately narrower than "everything the role can technically read":
 * a trainer with `dashboard:view` should land on delivery numbers, not
 * organisation-wide revenue, even though no rule forbids the latter.
 */
export function sectionsForRole(role: StaffRole, counts: DashboardCounts): DashboardSection[] {
  switch (role) {
    case 'founder':
      // SOP 18.10 — the Founder KPI dashboard is the full set.
      return [
        acquisitionSection(counts),
        academicSection(counts),
        outcomesSection(counts),
        financeSection(counts),
        growthPartnersSection(counts),
      ];
    case 'ops_manager':
      return [
        acquisitionSection(counts),
        academicSection(counts),
        outcomesSection(counts),
        growthPartnersSection(counts),
      ];
    case 'system_admin':
      // Platform administration, not business performance — Growth Partner
      // onboarding oversight is the one business-shaped exception it owns.
      return [academicSection(counts), growthPartnersSection(counts)];
    case 'consultant':
      return [acquisitionSection(counts)];
    case 'coordinator':
    case 'trainer':
      return [academicSection(counts)];
    case 'finance':
      return [financeSection(counts), growthPartnersSection(counts)];
    case 'placement':
      return [outcomesSection(counts)];
  }
}

/** Rupee display from integer paise (ADR-012) — display only. */
export function formatMetricValue(metric: Metric): string {
  if (metric.state === 'unavailable') return '—';
  switch (metric.format) {
    case 'percent':
      return `${metric.value}%`;
    case 'currency': {
      const rupees = Math.trunc(metric.value / 100);
      return `₹${rupees.toLocaleString('en-IN')}`;
    }
    case 'count':
    default:
      return metric.value.toLocaleString('en-IN');
  }
}
