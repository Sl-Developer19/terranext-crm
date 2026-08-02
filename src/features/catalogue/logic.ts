import { formatPaise } from '@/lib/utils/format';

import type { Installment } from './schema';

export { formatPaise };

/**
 * Pure catalogue rules (no I/O). The fee-plan arithmetic here is the same
 * arithmetic the fee ledger will rely on (M7), so it lives in one place and
 * is unit-tested rather than re-derived per call site.
 */

/** Integer paise sum — ADR-012: money never touches floating point. */
export function sumInstallments(installments: readonly Installment[]): number {
  return installments.reduce((total, installment) => total + installment.amountPaise, 0);
}

/**
 * A fee plan is only usable if its parts equal its total. An unbalanced plan
 * creates a fee account that can never reconcile, so this is enforced at the
 * catalogue boundary rather than discovered during collections.
 */
export function isFeePlanBalanced(
  totalPaise: number,
  installments: readonly Installment[],
): boolean {
  return installments.length === 0 || sumInstallments(installments) === totalPaise;
}

/**
 * BR-03 certificate eligibility thresholds are configuration, not code.
 * Both are percentages; anything outside 0–100 is a data error, not a policy.
 */
export function areCertificateRulesValid(
  minAttendancePct: number,
  minAssessmentScore: number,
): boolean {
  const inRange = (value: number) => Number.isInteger(value) && value >= 0 && value <= 100;
  return inRange(minAttendancePct) && inRange(minAssessmentScore);
}

/** Derives a URL-safe slug from an academy name (advisory — the user may edit). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Catalogue entities are archived, never deleted (Doc 03 §4): they are
 * referenced history — a programme with certificates issued against it must
 * remain resolvable forever.
 */
export function canArchive(programmeCount: number): boolean {
  return programmeCount === 0;
}
