import 'server-only';

import {
  countFamilyConversions,
  findFamilyById,
  findFamilyProgrammeHistory,
  findFamilies,
  findParentSessions,
  findParents,
} from './repository';
import type {
  Family,
  FamilyFilters,
  FamilyProgrammeHistoryRow,
  PaginatedFamilies,
  Parent,
  ParentSession,
} from './schema';

/** Read models for the parent & family screens. */

export async function listFamilies(filters: FamilyFilters): Promise<PaginatedFamilies> {
  return findFamilies(filters);
}

export async function getFamily(familyId: string): Promise<Family | null> {
  return findFamilyById(familyId);
}

export async function listParents(familyId: string): Promise<Parent[]> {
  return findParents(familyId);
}

export async function listParentSessions(familyId: string): Promise<ParentSession[]> {
  return findParentSessions(familyId);
}

export async function listFamilyProgrammeHistory(
  familyId: string,
): Promise<FamilyProgrammeHistoryRow[]> {
  return findFamilyProgrammeHistory(familyId);
}

/** Feeds the Parent Conversion Report (module 5). */
export async function getParentConversionStats(): Promise<{
  total: number;
  leadCreated: number;
  enrolled: number;
}> {
  return countFamilyConversions();
}
