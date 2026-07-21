/** Public API of the parents feature (Doc 02 §3). */
export { CreateFamilyDialog } from './components/create-family-dialog';
export { FamiliesTable } from './components/families-table';
export { FamilyDetailView } from './components/family-detail-view';
export { FamilyFilters } from './components/family-filters';
export {
  getFamily,
  getParentConversionStats,
  listFamilies,
  listFamilyProgrammeHistory,
  listParentSessions,
  listParents,
} from './queries';
export { conversionRate } from './logic';
export {
  familyFiltersSchema,
  type Family,
  type FamilyProgrammeHistoryRow,
  type PaginatedFamilies,
  type Parent,
  type ParentSession,
} from './schema';
