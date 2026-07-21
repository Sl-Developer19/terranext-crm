/** Public API of the batches feature (Doc 02 §3). */
export { AllocateBatchDialog } from './components/allocate-batch-dialog';
export { BatchDialog } from './components/batch-dialog';
export { BatchesTable } from './components/batches-table';
export { BatchWorkspace } from './components/batch-workspace';
export {
  getBatch,
  listAllocatableBatches,
  listBatches,
  listRoster,
  listSessions,
  listTrainers,
} from './queries';
export {
  BATCH_STATUSES,
  batchFiltersSchema,
  type Batch,
  type BatchFilters as BatchFilterValues,
  type BatchSession,
  type BatchStatus,
  type RosterEntry,
} from './schema';
