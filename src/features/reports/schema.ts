import { z } from 'zod';

import type { Permission } from '@/lib/rbac/permissions';

/**
 * Reports centre (S42, Doc 16). The catalogue is the set of reports the
 * business rules matrix actually names — each entry cites the rule it serves,
 * so a report can never drift into "a number someone liked" with no owner.
 *
 * Runs are live aggregations over existing collections rather than a `stats`
 * precompute (Doc 22 M8 notes the same trade-off the dashboard made). Each
 * loader is bounded; when the base outgrows the cap the fix is a scheduled
 * precompute, not a bigger scan.
 */

export const REPORT_IDS = [
  'batch-utilisation',
  'attendance-risk',
  'lead-source',
  'counselling-conversion',
  'alumni-growth',
  'duplicate-suspect-leads',
  'placement-funnel',
] as const;
export type ReportId = (typeof REPORT_IDS)[number];

export const runReportSchema = z.object({ reportId: z.enum(REPORT_IDS) }).strict();
export type RunReportInput = z.infer<typeof runReportSchema>;

export const exportReportSchema = z.object({ reportId: z.enum(REPORT_IDS) }).strict();
export type ExportReportInput = z.infer<typeof exportReportSchema>;

export interface ReportColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell>;

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Shown above the table — states what the figures mean or flags an integrity result. */
  note?: string;
}

export interface ReportDefinition {
  id: ReportId;
  label: string;
  /** The business rule or SOP the report answers to. */
  source: string;
  description: string;
  /** Viewing the report requires this on top of `reports:view`. */
  requires: Permission;
  columns: ReportColumn[];
}

export const REPORT_CATALOGUE: readonly ReportDefinition[] = [
  {
    id: 'batch-utilisation',
    label: 'Batch utilisation',
    source: 'BR-04 · weekly Batch Progress (SOP 18.7)',
    description: 'Seats filled against capacity for every batch, worst-utilised first.',
    requires: 'batches:view',
    columns: [
      { key: 'batchName', label: 'Batch' },
      { key: 'programmeName', label: 'Programme' },
      { key: 'status', label: 'Status' },
      { key: 'enrolled', label: 'Enrolled', numeric: true },
      { key: 'capacity', label: 'Capacity', numeric: true },
      { key: 'utilisationPct', label: 'Utilisation %', numeric: true },
    ],
  },
  {
    id: 'attendance-risk',
    label: 'Attendance risk',
    source: 'BR-03 · attendance risk report (Academy §21)',
    description:
      'Participants whose attendance sits below their programme certification threshold while their batch is still running — the window where intervention still helps.',
    requires: 'attendance:view',
    columns: [
      { key: 'participantName', label: 'Participant' },
      { key: 'participantId', label: 'ID' },
      { key: 'batchName', label: 'Batch' },
      { key: 'attendancePct', label: 'Attendance %', numeric: true },
      { key: 'requiredPct', label: 'Required %', numeric: true },
      { key: 'shortfallPct', label: 'Shortfall', numeric: true },
    ],
  },
  {
    id: 'lead-source',
    label: 'Lead source breakdown',
    source: 'FR-07 · campaign/college-wise lead source reports',
    description: 'Where enquiries come from and how many of each source convert.',
    requires: 'leads:view',
    columns: [
      { key: 'source', label: 'Source' },
      { key: 'total', label: 'Leads', numeric: true },
      { key: 'admitted', label: 'Admitted', numeric: true },
      { key: 'conversionPct', label: 'Conversion %', numeric: true },
    ],
  },
  {
    id: 'counselling-conversion',
    label: 'Counselling conversion',
    source: 'BR-02 · weekly conversion rate (SOP 18.7) + always-zero integrity check',
    description:
      'Counselling-to-admission conversion, plus the count of admissions with no counselling session behind them — which must always be zero.',
    requires: 'counselling:view',
    columns: [
      { key: 'metric', label: 'Metric' },
      { key: 'value', label: 'Value', numeric: true },
    ],
  },
  {
    id: 'alumni-growth',
    label: 'Alumni growth',
    source: 'BR-05 · alumni growth KPI (SOP 18.10)',
    description: 'New alumni per month, by the date membership was granted.',
    requires: 'alumni:view',
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'newAlumni', label: 'New alumni', numeric: true },
      { key: 'runningTotal', label: 'Running total', numeric: true },
    ],
  },
  {
    id: 'duplicate-suspect-leads',
    label: 'Duplicate-suspect leads',
    source: 'BR-01 · single-record integrity (Phase 01)',
    description:
      'Phone numbers carrying more than one unconverted lead — the duplicates that would break the one-person-one-record promise if converted as-is.',
    requires: 'leads:view',
    columns: [
      { key: 'phone', label: 'Phone' },
      { key: 'leadCount', label: 'Open leads', numeric: true },
      { key: 'names', label: 'Names on file' },
    ],
  },
  {
    id: 'placement-funnel',
    label: 'Placement-support funnel',
    source: 'BR-09 · placement-support pipeline (Academy §21)',
    description: 'Evaluated → eligible → placed, the funnel BR-09 gates.',
    requires: 'placements:view',
    columns: [
      { key: 'stage', label: 'Stage' },
      { key: 'count', label: 'Participants', numeric: true },
    ],
  },
];

export function findReport(reportId: string): ReportDefinition | undefined {
  return REPORT_CATALOGUE.find((report) => report.id === reportId);
}
