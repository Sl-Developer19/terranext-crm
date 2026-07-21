import 'server-only';

import { findEmployerById, findEmployerOptions, findEmployers } from './repository';
import type { Employer, EmployerOption } from './schema';

/** Read models for the employer directory (S32) and cross-feature picklists. */

export async function listEmployers(): Promise<Employer[]> {
  return findEmployers();
}

/** Active employers only — the picklist the placements pipeline consumes. */
export async function listEmployerOptions(): Promise<EmployerOption[]> {
  return findEmployerOptions();
}

export async function getEmployer(employerId: string): Promise<Employer | null> {
  return findEmployerById(employerId);
}
