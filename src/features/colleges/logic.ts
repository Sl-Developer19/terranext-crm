import type { StatusKind } from '@/components/ui/badge';

import type { College, CollegeStatus } from './schema';

/** Pure college rules (no I/O). */

export function statusTone(status: CollegeStatus): StatusKind {
  return status === 'active' ? 'success' : 'neutral';
}

export function statusLabel(status: CollegeStatus): string {
  return status === 'active' ? 'Active' : 'Archived';
}

/** Conversion rate for a college's referred leads, null when it has sent none. */
export function conversionPct(
  college: Pick<College, 'leadCount' | 'admittedCount'>,
): number | null {
  if (college.leadCount <= 0) return null;
  return Math.round((college.admittedCount / college.leadCount) * 1000) / 10;
}

export interface CollegeFilter {
  search?: string | undefined;
  status?: CollegeStatus | undefined;
}

export function filterColleges(colleges: readonly College[], filter: CollegeFilter): College[] {
  const needle = filter.search?.trim().toLowerCase() ?? '';
  return colleges.filter((college) => {
    if (filter.status && college.status !== filter.status) return false;
    if (needle) {
      const haystack =
        `${college.name} ${college.city} ${college.contactPerson ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** Most productive source first — the ranking that makes the list actionable. */
export function sortByContribution(colleges: readonly College[]): College[] {
  return [...colleges].sort((a, b) => {
    if (b.leadCount !== a.leadCount) return b.leadCount - a.leadCount;
    return a.name.localeCompare(b.name);
  });
}
