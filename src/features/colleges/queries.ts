import 'server-only';

import { sortByContribution } from './logic';
import { findCampusLeaders, findCollegeById, findColleges } from './repository';
import type { CampusLeader, College } from './schema';

/** Read models for the college master (S15). */

export async function listColleges(): Promise<College[]> {
  return sortByContribution(await findColleges());
}

export async function getCollege(collegeId: string): Promise<College | null> {
  return findCollegeById(collegeId);
}

export async function listCampusLeaders(collegeId: string): Promise<CampusLeader[]> {
  return findCampusLeaders(collegeId);
}
