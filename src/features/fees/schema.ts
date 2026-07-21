import { z } from 'zod';

/**
 * Fee accounts and the payment ledger (Doc 03 §1.7, Doc 14 §17, ADR-012).
 *
 * Money is integer paise everywhere — never floats, never rupee decimals in
 * storage. `payments` is append-only: a correction is a reversing entry, not
 * an edit, so the ledger always reconstructs the true balance.
 */

export const INSTALLMENT_STATUSES = ['pending', 'paid', 'overdue'] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const paise = z.number().int();
const positivePaise = paise.positive('Amount must be greater than zero');

export const createFeeAccountSchema = z
  .object({
    participantId: z.string().min(1),
    enrolmentId: z.string().min(1),
  })
  .strict();

export type CreateFeeAccountInput = z.infer<typeof createFeeAccountSchema>;

export const recordPaymentSchema = z
  .object({
    feeAccountId: z.string().min(1),
    amountPaise: positivePaise,
    method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Select a payment method' }) }),
    receivedAt: z.string().min(1, 'Payment date is required'),
    note: z.string().trim().max(300).optional().or(z.literal('')),
  })
  .strict();

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const reversePaymentSchema = z
  .object({
    feeAccountId: z.string().min(1),
    paymentId: z.string().min(1),
    reason: z
      .string()
      .trim()
      .min(10, 'A reversal reason of at least 10 characters is required')
      .max(300),
  })
  .strict();

export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;

export const applyDiscountSchema = z
  .object({
    feeAccountId: z.string().min(1),
    discountPaise: positivePaise,
    reason: z
      .string()
      .trim()
      .min(10, 'A discount reason of at least 10 characters is required')
      .max(300),
  })
  .strict();

export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface FeeInstallment {
  label: string;
  amountPaise: number;
  dueDate: string;
  status: InstallmentStatus;
}

export interface FeeAccount {
  /** Doc ID = enrolment ID (Doc 03 §1.7 — one account per enrolment). */
  id: string;
  participantId: string;
  participantName: string | null;
  programmeId: string;
  programmeName: string | null;
  totalPaise: number;
  discountPaise: number;
  discountApprovedBy: string | null;
  installments: FeeInstallment[];
  paidPaise: number;
  balancePaise: number;
  nextDueDate: string | null;
}

export interface Payment {
  id: string;
  amountPaise: number;
  method: PaymentMethod;
  receivedAt: string;
  receivedBy: string;
  receiptNo: string;
  note: string | null;
  /** A reversing entry carries a negative amount and points at its original. */
  reversesPaymentId: string | null;
  reversedByPaymentId: string | null;
}

export interface PendingFeeRow {
  feeAccountId: string;
  participantId: string;
  participantName: string;
  programmeName: string | null;
  balancePaise: number;
  nextDueDate: string | null;
  overdue: boolean;
}
