import 'server-only';

import { findAlumniRecordById, findAlumniRecords } from './repository';
import type { AlumniRecord } from './schema';

/** Read models for the alumni registry (S33). */

export async function listAlumniRecords(): Promise<AlumniRecord[]> {
  return findAlumniRecords();
}

export async function getAlumniRecord(participantId: string): Promise<AlumniRecord | null> {
  return findAlumniRecordById(participantId);
}
