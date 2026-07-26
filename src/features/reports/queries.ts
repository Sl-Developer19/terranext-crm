import 'server-only';

import {
  buildAlumniGrowth,
  buildAttendanceRisk,
  buildBatchUtilisation,
  buildCounsellingConversion,
  buildDuplicateSuspects,
  buildGrowthPartnerRewards,
  buildLeadSource,
  buildPlacementFunnel,
} from './logic';
import {
  loadAlumniMemberSince,
  loadAttendanceRisk,
  loadBatchUtilisation,
  loadCounsellingConversion,
  loadDuplicateSuspects,
  loadGrowthPartnerRewards,
  loadLeadSources,
  loadPlacementFunnel,
} from './repository';
import { findReport, type ReportId, type ReportResult } from './schema';

/** Runs a catalogue report (S42). Columns come from the definition, rows from the builder. */
export async function runReport(reportId: ReportId): Promise<ReportResult> {
  const definition = findReport(reportId);
  if (!definition) throw new Error(`Unknown report: ${reportId}`);

  const result = await buildResult(reportId);
  return { ...result, columns: definition.columns };
}

async function buildResult(reportId: ReportId): Promise<ReportResult> {
  switch (reportId) {
    case 'batch-utilisation':
      return buildBatchUtilisation(await loadBatchUtilisation());
    case 'attendance-risk':
      return buildAttendanceRisk(await loadAttendanceRisk());
    case 'lead-source':
      return buildLeadSource(await loadLeadSources());
    case 'counselling-conversion':
      return buildCounsellingConversion(await loadCounsellingConversion());
    case 'alumni-growth':
      return buildAlumniGrowth(await loadAlumniMemberSince());
    case 'duplicate-suspect-leads':
      return buildDuplicateSuspects(await loadDuplicateSuspects());
    case 'placement-funnel':
      return buildPlacementFunnel(await loadPlacementFunnel());
    case 'growth-partner-rewards':
      return buildGrowthPartnerRewards(await loadGrowthPartnerRewards());
  }
}
