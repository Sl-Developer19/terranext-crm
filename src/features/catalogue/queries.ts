import 'server-only';

import { findAcademies, findProgrammeOptions, findProgrammes } from './repository';
import type { Academy, Programme, ProgrammeOption } from './schema';

/** Read models for the catalogue screen (S22) and cross-feature picklists. */

export async function listAcademies(): Promise<Academy[]> {
  return findAcademies();
}

export async function listProgrammes(): Promise<Programme[]> {
  return findProgrammes();
}

/**
 * Active programmes for picklists in other features (batches, enrolments).
 * Archived programmes are excluded so they cannot be newly referenced, while
 * remaining resolvable for records that already point at them.
 */
export async function listProgrammeOptions(): Promise<ProgrammeOption[]> {
  return findProgrammeOptions();
}
