import type { StaffRole } from '@/types/common';

/**
 * CRM dashboard metrics (SOP 15.9 dashboard + SOP 18.10 Founder KPI set).
 *
 * A metric is a discriminated shape rather than a bare number, because the
 * SOP asks for metrics whose source modules do not exist yet (Placement
 * Rate, Participant Satisfaction). Rendering those as `0` would be actively
 * misleading — a founder reading "Placement Rate: 0%" concludes placements
 * are failing, not that the module was never built. `unavailable` says so.
 */

export type MetricFormat = 'count' | 'percent' | 'currency';

export type Metric =
  | {
      state: 'ok';
      key: MetricKey;
      label: string;
      value: number;
      format: MetricFormat;
      /** Optional supporting line, e.g. "of 412 enrolments". */
      detail?: string;
    }
  | {
      state: 'unavailable';
      key: MetricKey;
      label: string;
      format: MetricFormat;
      /** Why there is no number — shown verbatim to the user. */
      reason: string;
    }
  | {
      state: 'partial';
      key: MetricKey;
      label: string;
      value: number;
      format: MetricFormat;
      /** What the number does and does not include. */
      caveat: string;
    };

export const METRIC_KEYS = [
  // SOP 15.9 — CRM dashboard
  'totalEnquiries',
  'counsellingAppointments',
  'admissions',
  'activeBatches',
  'attendancePercentage',
  'assessmentCompletion',
  'certificatesIssued',
  'placementStatistics',
  'alumniGrowth',
  'revenueSummary',
  'trainerUtilisation',
  // SOP 18.10 — Founder KPI dashboard (additions beyond 15.9)
  'totalActiveParticipants',
  'admissionsThisMonth',
  'programmeCompletionRate',
  'participantSatisfaction',
  'operationalCompliance',
  // SOP 15.14 — CRM effectiveness KPIs
  'enquiryToAdmissionRate',
  'parentConversionRate',
  'outstandingFees',
  // Doc 25 §6 — Growth Partner Management System (individual partners).
  // Unchanged since these are already generic across every partner kind
  // (Feature 9 architecture review) — never renamed, never re-scoped.
  'gpTotalPartners',
  'gpActivePartners',
  'gpTotalReferrals',
  'gpReferralConversionRate',
  'gpRewardsGenerated',
  'gpRewardsPaid',
  'gpPendingRewards',
  // TerraNext Community Growth Network (Feature 9) — additive, no `gp`
  // prefix since these represent the whole "Partner Network" section
  // (both individual Growth Partners and Community Partners), not one
  // programme.
  'cpTotalPartners',
  'cpActivePartners',
  'combinedTotalPartners',
  'qualifiedReferrals',
  'convertedReferrals',
  'walletBalance',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export interface DashboardSection {
  title: string;
  /** Why this section matters — one line, shown under the heading. */
  description: string;
  metrics: Metric[];
}

export interface DashboardData {
  role: StaffRole;
  sections: DashboardSection[];
  /** Server time the figures were computed, for the "as at" line. */
  generatedAt: string;
}

/** Raw aggregate counts the repository returns; logic turns these into metrics. */
export interface DashboardCounts {
  leadsTotal: number;
  leadsAdmitted: number;
  participantsTotal: number;
  participantsActive: number;
  participantsCompleted: number;
  admissionsThisMonth: number;
  batchesActive: number;
  batchesTotal: number;
  certificatesIssued: number;
  alumniTotal: number;
  alumniThisMonth: number;
  parentSessionsTotal: number;
  familiesTotal: number;
  familiesConverted: number;
  trainersTotal: number;
  trainersAssigned: number;
  assessmentsTotal: number;
  assessmentsScored: number;
  /** Mean attendancePct across enrolments that have any attendance recorded. */
  attendancePctMean: number;
  attendanceSampleSize: number;
  revenuePaisePaid: number;
  revenuePaiseOutstanding: number;
  /** Doc 25 §6 — Growth Partner Management System (individual partners). */
  gpTotalPartners: number;
  gpActivePartners: number;
  gpTotalReferrals: number;
  gpAdmittedReferrals: number;
  gpRewardsAccruedPaise: number;
  gpRewardsPaidPaise: number;
  /** TerraNext Community Growth Network (Feature 9). `qualifiedReferrals` is
   * a referral-attributed lead that has reached `counselling_attended`,
   * `hot`, or `admitted` — genuinely engaged, not merely a raw enquiry.
   * `gpAdmittedReferrals` above is reused as-is for "Converted Referrals"
   * (no new field — same count, a second Metric view of it). */
  cpTotalPartners: number;
  cpActivePartners: number;
  qualifiedReferrals: number;
  walletBalancePaise: number;
  /** True for a source whose bounded scan (Doc 11 §8 SCAN_CAP) hit the cap —
   * the corresponding count/total is a floor, not the true figure. */
  scanCapped: {
    trainers: boolean;
    assessments: boolean;
    attendance: boolean;
    revenue: boolean;
    gpRewards: boolean;
    walletBalance: boolean;
  };
}
