import type { FeeInstallment, InstallmentStatus } from './schema';

/**
 * Pure fee arithmetic (no I/O), ADR-012: integer paise only.
 *
 * Every number here is exact integer arithmetic. Floating-point money is the
 * classic source of balances that are off by a paisa and never reconcile, so
 * rupees exist only at the display boundary.
 */

export interface LedgerEntry {
  amountPaise: number;
}

/**
 * Paid total from the ledger. Reversing entries carry negative amounts, so
 * summing the whole ledger naturally nets them out — there is no separate
 * "is this reversed?" branch to get wrong.
 */
export function sumLedger(entries: readonly LedgerEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amountPaise, 0);
}

/** Net payable after discount. Never negative — a discount cannot create credit. */
export function netPayable(totalPaise: number, discountPaise: number): number {
  return Math.max(0, totalPaise - discountPaise);
}

/** Outstanding balance. Never negative; an overpayment shows as zero owing. */
export function calculateBalance(
  totalPaise: number,
  discountPaise: number,
  paidPaise: number,
): number {
  return Math.max(0, netPayable(totalPaise, discountPaise) - paidPaise);
}

/** A discount may never exceed what is actually owed. */
export function isDiscountValid(totalPaise: number, discountPaise: number): boolean {
  return discountPaise >= 0 && discountPaise <= totalPaise;
}

/**
 * Payments above the outstanding balance are refused. Accepting them would
 * create a liability the ledger has no concept of; a genuine advance is a
 * business decision that belongs in a policy discussion, not a silent write.
 */
export function isPaymentWithinBalance(amountPaise: number, balancePaise: number): boolean {
  return amountPaise > 0 && amountPaise <= balancePaise;
}

/**
 * Marks installments paid in due-date order as money arrives — the standard
 * allocation rule: the oldest obligation is settled first.
 *
 * Overdue is derived from the due date against `asOf`, never stored as a
 * separate truth that could disagree with the dates.
 */
export function allocateInstallments(
  installments: readonly FeeInstallment[],
  paidPaise: number,
  asOf: Date,
): FeeInstallment[] {
  const today = asOf.toISOString().slice(0, 10);
  let remaining = paidPaise;

  return [...installments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((installment) => {
      let status: InstallmentStatus;
      if (remaining >= installment.amountPaise) {
        remaining -= installment.amountPaise;
        status = 'paid';
      } else {
        // Partially covered still counts as outstanding — an installment is
        // paid or it is not; there is no half-paid state in the plan.
        remaining = 0;
        status = installment.dueDate < today ? 'overdue' : 'pending';
      }
      return { ...installment, status };
    });
}

/** The earliest unpaid installment's due date — drives the pending-fee report. */
export function nextDueDate(installments: readonly FeeInstallment[]): string | null {
  const unpaid = installments
    .filter((installment) => installment.status !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return unpaid[0]?.dueDate ?? null;
}

/**
 * Due date for an installment, from the enrolment date plus the plan's
 * offset (`programmes.feePlanDefault.installments[].dueOffsetDays`).
 */
export function dueDateFromOffset(enrolledAt: Date, offsetDays: number): string {
  const due = new Date(enrolledAt);
  due.setUTCDate(due.getUTCDate() + offsetDays);
  return due.toISOString().slice(0, 10);
}

/**
 * Gapless receipt number per financial year (Doc 03 §8 Q1, assumed format
 * `RCP-<FY>-<seq>`). The Indian FY runs April–March, so a January payment
 * belongs to the FY that started the previous April.
 */
export function financialYear(date: Date): string {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function formatReceiptNo(prefix: string, fy: string, sequence: number): string {
  return `${prefix}-${fy}-${String(sequence).padStart(5, '0')}`;
}
