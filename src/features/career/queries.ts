import 'server-only';

import { findCareerProfileById, findCareerProfiles, findGuidanceSessions } from './repository';
import type { CareerProfile, CareerProfileListItem, GuidanceSession } from './schema';

export async function listCareerProfiles(): Promise<CareerProfileListItem[]> {
  return findCareerProfiles();
}

export async function getCareerProfile(participantId: string): Promise<CareerProfile | null> {
  return findCareerProfileById(participantId);
}

export async function listGuidanceSessions(participantId: string): Promise<GuidanceSession[]> {
  return findGuidanceSessions(participantId);
}
