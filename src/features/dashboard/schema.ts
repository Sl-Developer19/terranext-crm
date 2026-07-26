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
  // Doc 25 §6 — Growth Partner Management System
  'gpTotalPartners',
  'gpActivePartners',
  'gpTotalReferrals',
  'gpReferralConversionRate',
  'gpRewardsGenerated',
  'gpRewardsPaid',
  'gpPendingRewards',
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
  /** Doc 25 §6 — Growth Partner Management System. */
  gpTotalPartners: number;
  gpActivePartners: number;
  gpTotalReferrals: number;
  gpAdmittedReferrals: number;
  gpRewardsAccruedPaise: number;
  gpRewardsPaidPaise: number;
}
