/** Public API of the catalogue feature (Doc 02 §3). */
export { CatalogueView } from './components/catalogue-view';
export { listAcademies, listProgrammeOptions, listProgrammes } from './queries';
export { formatPaise } from './logic';
export {
  CATALOGUE_STATUSES,
  type Academy,
  type CatalogueStatus,
  type Installment,
  type Programme,
  type ProgrammeOption,
} from './schema';
