import type { ReportResult, ReportRow } from './schema';

/**
 * Pure report builders (no I/O). Each takes already-loaded raw rows and
 * returns the rendered result, so every figure in the reports centre is
 * unit-testable without Firestore.
 */

/** Percentage to one decimal, or null when the denominator is zero. */
export function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/* ── BR-04 · batch utilisation ─────────────────────────────────────────── */

export interface BatchUtilisationInput {
  batchName: string;
  programmeName: string;
  status: string;
  enrolled: number;
  capacity: number;
}

export function buildBatchUtilisation(batches: readonly BatchUtilisationInput[]): ReportResult {
  const rows: ReportRow[] = batches
    .map((batch) => ({
      batchName: batch.batchName,
      programmeName: batch.programmeName,
      status: batch.status,
      enrolled: batch.enrolled,
      capacity: batch.capacity,
      utilisationPct: pct(batch.enrolled, batch.capacity),
    }))
    // Worst-utilised first: this report exists to find the batches that need
    // filling, so an empty batch belongs at the top, not buried.
    .sort((a, b) => (a.utilisationPct ?? -1) - (b.utilisationPct ?? -1));

  return {
    columns: [],
    rows,
    note: `${rows.length} batch${rows.length === 1 ? '' : 'es'}, least-filled first.`,
  };
}

/* ── BR-03 · attendance risk ───────────────────────────────────────────── */

export interface AttendanceRiskInput {
  participantName: string;
  participantId: string;
  batchName: string;
  batchRunning: boolean;
  attendancePct: number;
  requiredPct: number;
}

export function buildAttendanceRisk(rows: readonly AttendanceRiskInput[]): ReportResult {
  // Only running batches: flagging someone whose batch already ended is noise,
  // not a risk anyone can still act on.
  const atRisk = rows
    .filter((row) => row.batchRunning && row.attendancePct < row.requiredPct)
    .map((row) => ({
      participantName: row.participantName,
      participantId: row.participantId,
      batchName: row.batchName,
      attendancePct: row.attendancePct,
      requiredPct: row.requiredPct,
      shortfallPct: Math.round((row.requiredPct - row.attendancePct) * 10) / 10,
    }))
    .sort((a, b) => b.shortfallPct - a.shortfallPct);

  return {
    columns: [],
    rows: atRisk,
    note:
      atRisk.length === 0
        ? 'No participant in a running batch is below their certification threshold.'
        : `${atRisk.length} participant${atRisk.length === 1 ? '' : 's'} below threshold, largest shortfall first.`,
  };
}

/* ── FR-07 · lead source breakdown ─────────────────────────────────────── */

export interface LeadSourceInput {
  source: string;
  admitted: boolean;
}

export function buildLeadSource(leads: readonly LeadSourceInput[]): ReportResult {
  const totals = new Map<string, { total: number; admitted: number }>();
  for (const lead of leads) {
    const entry = totals.get(lead.source) ?? { total: 0, admitted: 0 };
    entry.total += 1;
    if (lead.admitted) entry.admitted += 1;
    totals.set(lead.source, entry);
  }

  const rows: ReportRow[] = [...totals.entries()]
    .map(([source, entry]) => ({
      source,
      total: entry.total,
      admitted: entry.admitted,
      conversionPct: pct(entry.admitted, entry.total),
    }))
    .sort((a, b) => b.total - a.total);

  return { columns: [], rows, note: `${leads.length} lead${leads.length === 1 ? '' : 's'} total.` };
}

/* ── BR-02 · counselling conversion + integrity check ──────────────────── */

export interface CounsellingConversionInput {
  counselled: number;
  admitted: number;
  /**
   * Admissions with no counselling session on record — BR-02 says always zero.
   * `null` when the figure is not assessable: the counselling module (S12) is
   * not built, so no lead carries a counselling milestone to check against.
   * Reporting a zero here would assert an integrity guarantee nothing verified.
   */
  admittedWithoutCounselling: number | null;
}

export function buildCounsellingConversion(input: CounsellingConversionInput): ReportResult {
  const rows: ReportRow[] = [
    { metric: 'Leads counselled', value: input.counselled },
    { metric: 'Leads admitted', value: input.admitted },
    { metric: 'Conversion %', value: pct(input.admitted, input.counselled) },
    {
      metric: 'Admitted without counselling (must be 0)',
      value: input.admittedWithoutCounselling,
    },
  ];

  let note: string;
  if (input.admittedWithoutCounselling === null) {
    note =
      'Conversion is measured from lead stages. The BR-02 always-zero integrity check is not assessable yet — it needs the counselling module (S12), which records the session evidence an admission must have behind it.';
  } else if (input.admittedWithoutCounselling === 0) {
    note = 'Integrity check passed: every admission has a counselling session behind it (BR-02).';
  } else {
    note = `Integrity check FAILED: ${input.admittedWithoutCounselling} admission(s) bypassed counselling. BR-02 requires this to be zero — investigate before relying on the conversion figure.`;
  }

  return { columns: [], rows, note };
}

/* ── BR-05 · alumni growth ─────────────────────────────────────────────── */

/** ISO month key (`2026-07`) so ordering is lexicographic and locale-free. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function buildAlumniGrowth(memberSinceDates: readonly string[]): ReportResult {
  const perMonth = new Map<string, number>();
  for (const iso of memberSinceDates) {
    if (!iso) continue;
    const key = monthKey(iso);
    perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
  }

  let running = 0;
  const rows: ReportRow[] = [...perMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, newAlumni]) => {
      running += newAlumni;
      return { month, newAlumni, runningTotal: running };
    });

  return { columns: [], rows, note: `${running} alumni in total.` };
}

/* ── BR-01 · duplicate-suspect leads ───────────────────────────────────── */

export interface DuplicateSuspectInput {
  phone: string;
  name: string;
  converted: boolean;
}

export function buildDuplicateSuspects(leads: readonly DuplicateSuspectInput[]): ReportResult {
  const byPhone = new Map<string, string[]>();
  for (const lead of leads) {
    // Converted leads already became a participant record — a second open
    // lead on the same phone is the duplicate risk, not the conversion.
    if (lead.converted || !lead.phone) continue;
    byPhone.set(lead.phone, [...(byPhone.get(lead.phone) ?? []), lead.name]);
  }

  const rows: ReportRow[] = [...byPhone.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([phone, names]) => ({
      phone,
      leadCount: names.length,
      names: names.join(', '),
    }))
    .sort((a, b) => Number(b.leadCount) - Number(a.leadCount));

  return {
    columns: [],
    rows,
    note:
      rows.length === 0
        ? 'No phone number carries more than one open lead (BR-01 holds).'
        : `${rows.length} phone number${rows.length === 1 ? '' : 's'} with more than one open lead — merge before converting.`,
  };
}

/* ── BR-09 · placement-support funnel ──────────────────────────────────── */

export interface PlacementFunnelInput {
  evaluated: number;
  eligible: number;
  placed: number;
}

export function buildPlacementFunnel(input: PlacementFunnelInput): ReportResult {
  return {
    columns: [],
    rows: [
      { stage: 'Evaluated', count: input.evaluated },
      { stage: 'Eligible (BR-09)', count: input.eligible },
      { stage: 'Placed', count: input.placed },
    ],
    note: 'Eligibility is a selective human decision, never automatic (BR-09).',
  };
}

/* ── Doc 25 §13/§15 · Growth Partner rewards ─────────────────────────────── */

export interface GrowthPartnerRewardInput {
  partnerId: string;
  partnerName: string;
  amountPaise: number;
  status: 'accrued' | 'paid';
}

export function buildGrowthPartnerRewards(rows: readonly GrowthPartnerRewardInput[]): ReportResult {
  const totals = new Map<
    string,
    { partnerName: string; rewardCount: number; accruedPaise: number; paidPaise: number }
  >();
  for (const row of rows) {
    const entry = totals.get(row.partnerId) ?? {
      partnerName: row.partnerName,
      rewardCount: 0,
      accruedPaise: 0,
      paidPaise: 0,
    };
    entry.rewardCount += 1;
    if (row.status === 'paid') entry.paidPaise += row.amountPaise;
    else entry.accruedPaise += row.amountPaise;
    totals.set(row.partnerId, entry);
  }

  const reportRows: ReportRow[] = [...totals.values()]
    .map((entry) => ({
      partnerName: entry.partnerName,
      rewardCount: entry.rewardCount,
      accruedRupees: Math.round(entry.accruedPaise / 100),
      paidRupees: Math.round(entry.paidPaise / 100),
    }))
    .sort((a, b) => b.paidRupees + b.accruedRupees - (a.paidRupees + a.accruedRupees));

  return {
    columns: [],
    rows: reportRows,
    note: `${rows.length} reward${rows.length === 1 ? '' : 's'} across ${totals.size} partner${totals.size === 1 ? '' : 's'}.`,
  };
}
