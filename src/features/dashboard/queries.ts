import 'server-only';

import type { StaffRole } from '@/types/common';

import { sectionsForRole } from './logic';
import { loadDashboardCounts } from './repository';
import type { DashboardData } from './schema';

/**
 * Composes the role-scoped dashboard (SOP 15.9 / 18.10).
 *
 * Aggregates are loaded once and sliced per role rather than per-section, so
 * a founder's four sections cost the same reads as a trainer's one.
 */
export async function getDashboard(role: StaffRole): Promise<DashboardData> {
  const counts = await loadDashboardCounts();
  return {
    role,
    sections: sectionsForRole(role, counts),
    generatedAt: new Date().toISOString(),
  };
}
