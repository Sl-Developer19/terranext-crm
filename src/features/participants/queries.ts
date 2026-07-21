import 'server-only';

import { adminDb } from '@/lib/firebase/admin';

import {
  findDocuments,
  findEnrolments,
  findParticipantById,
  findParticipants,
  findTimeline,
} from './repository';
import type {
  Enrolment,
  Participant,
  ParticipantDocument,
  ParticipantFilters,
  ParticipantListItem,
  TimelineEntry,
} from './schema';

/**
 * Read models for the participant screens (Doc 16 S20/S21). Thin composition
 * over the repository — page components never touch Firestore directly.
 */

async function resolveDisplayNames(uids: unknown[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids.filter((v): v is string => typeof v === 'string' && v !== ''))];
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (uid) => {
      const snap = await adminDb().collection('users').doc(uid).get();
      const name = snap.get('displayName');
      map.set(uid, typeof name === 'string' ? name : 'Unknown');
    }),
  );
  return map;
}

/** S20 directory with search + filters. */
export async function listParticipants(
  filters: ParticipantFilters,
): Promise<ParticipantListItem[]> {
  return findParticipants(filters);
}

export async function getParticipant(participantId: string): Promise<Participant | null> {
  return findParticipantById(participantId);
}

export async function listEnrolments(participantId: string): Promise<Enrolment[]> {
  return findEnrolments(participantId);
}

export async function listTimeline(participantId: string): Promise<TimelineEntry[]> {
  return findTimeline(participantId, resolveDisplayNames);
}

export async function listDocuments(participantId: string): Promise<ParticipantDocument[]> {
  return findDocuments(participantId);
}
