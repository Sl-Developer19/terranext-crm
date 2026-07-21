/** Public API of the employers feature (Doc 02 §3). */
export { EmployerDialog } from './components/employer-dialog';
export { EmployersTable } from './components/employers-table';
export { getEmployer, listEmployerOptions, listEmployers } from './queries';
export type { Employer, EmployerOption, EmployerStatus } from './schema';
