import 'server-only';

import { findFeeAccountById, findFeeAccounts, findPayments, findPendingFees } from './repository';
import type { FeeAccount, Payment, PendingFeeRow } from './schema';

/** Read models for S40 (fee accounts, pending-fee report). */

export async function listFeeAccounts(): Promise<FeeAccount[]> {
  return findFeeAccounts();
}

export async function getFeeAccount(feeAccountId: string): Promise<FeeAccount | null> {
  return findFeeAccountById(feeAccountId);
}

export async function listPayments(feeAccountId: string): Promise<Payment[]> {
  return findPayments(feeAccountId);
}

export async function listPendingFees(): Promise<PendingFeeRow[]> {
  return findPendingFees();
}
