/** Public API of the admissions feature (Doc 02 §3). */
export { AdmissionsQueue } from './components/admissions-queue';
export { ConvertLeadStepper } from './components/convert-lead-stepper';
export { readyCount } from './logic';
export { getConversionContext, listAdmissionCandidates } from './queries';
export type { AdmissionCandidate, ConvertLeadInput, DuplicateMatch } from './schema';
