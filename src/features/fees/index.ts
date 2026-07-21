/** Public API of the fees feature (Doc 02 §3). */
export { FeeAccountDetail } from './components/fee-account-detail';
export { FeeAccountsTable } from './components/fee-accounts-table';
export { PendingFeesTable } from './components/pending-fees-table';
export { getFeeAccount, listFeeAccounts, listPayments, listPendingFees } from './queries';
export type { FeeAccount, Payment, PendingFeeRow } from './schema';
