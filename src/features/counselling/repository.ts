import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type {
  CounsellingLeadOption,
  CounsellingSession,
  SessionMode,
  SessionOutcome,
} from './schema';

/** Counselling data access (Doc 03 §1.3, Doc 14 §9). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

interface Lookups {
  leadNames: Map<string, string>;
  userNames: Map<string, string>;
  programmeNames: Map<string, string>;
}

async function loadLookups(): Promise<Lookups> {
  const db = adminDb();
  const [leads, users, programmes] = await Promise.all([
    db.collection('leads').get(),
    db.collection('users').get(),
    db.collection('programmes').get(),
  ]);

  return {
    leadNames: new Map(leads.docs.map((d) => [d.id, asString(d.get('fullName'))])),
    userNames: new Map(users.docs.map((d) => [d.id, asString(d.get('displayName'))])),
    programmeNames: new Map(programmes.docs.map((d) => [d.id, asString(d.get('name'))])),
  };
}

function toSession(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  lookups: Lookups,
): CounsellingSession {
  const data = doc.data() ?? {};
  const raw = (data.recommendation ?? null) as Record<string, unknown> | null;
  const programmeId = raw ? asString(raw.programmeId) : '';

  return {
    id: doc.id,
    leadId: asString(data.leadId),
    leadName: lookups.leadNames.get(asString(data.leadId)) ?? asString(data.leadId),
    consultantUid: asString(data.consultantUid),
    consultantName:
      lookups.userNames.get(asString(data.consultantUid)) ?? asString(data.consultantUid),
    heldAt: toIso(data.heldAt),
    mode: (asString(data.mode) || 'in_person') as SessionMode,
    notes: asString(data.notes),
    needsAssessment: asStringOrNull(data.needsAssessment),
    recommendation:
      raw && programmeId
        ? {
            programmeId,
            programmeName: lookups.programmeNames.get(programmeId) ?? programmeId,
            remarks: asStringOrNull(raw.remarks),
          }
        : null,
    outcome: (asString(data.outcome) || 'follow_up') as SessionOutcome,
    createdAt: toIso(data.createdAt),
  };
}

export async function findSessions(): Promise<CounsellingSession[]> {
  const [snap, lookups] = await Promise.all([
    adminDb().collection('counsellingSessions').orderBy('heldAt', 'desc').limit(500).get(),
    loadLookups(),
  ]);
  return snap.docs.map((doc) => toSession(doc, lookups));
}

/** BR-02 evidence for one lead — used by the admissions checklist and convert transaction. */
export async function findSessionsForLead(leadId: string): Promise<CounsellingSession[]> {
  const [snap, lookups] = await Promise.all([
    adminDb().collection('counsellingSessions').where('leadId', '==', leadId).get(),
    loadLookups(),
  ]);
  return snap.docs
    .map((doc) => toSession(doc, lookups))
    .sort((a, b) => b.heldAt.localeCompare(a.heldAt));
}

/** Sessions grouped by lead, so the admissions queue costs one read, not one per row. */
export async function findSessionsByLead(): Promise<Map<string, CounsellingSession[]>> {
  const sessions = await findSessions();
  const byLead = new Map<string, CounsellingSession[]>();
  for (const session of sessions) {
    byLead.set(session.leadId, [...(byLead.get(session.leadId) ?? []), session]);
  }
  return byLead;
}

/** Leads a consultant can still counsel — the converted ones are no longer candidates. */
export async function findCounsellableLeads(): Promise<CounsellingLeadOption[]> {
  const snap = await adminDb().collection('leads').orderBy('fullName').limit(500).get();
  return snap.docs
    .filter((doc) => asString(doc.get('stage')) !== 'admitted')
    .map((doc) => ({
      id: doc.id,
      name: asString(doc.get('fullName')),
      stage: asString(doc.get('stage')),
    }));
}

export interface SessionWriteModel {
  leadId: string;
  heldAt: Date;
  mode: SessionMode;
  outcome: SessionOutcome;
  notes: string;
  needsAssessment: string | null;
  recommendation: { programmeId: string; remarks: string | null } | null;
}

export async function createSessionRecord(
  input: SessionWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('counsellingSessions').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    leadId: input.leadId,
    consultantUid: actorUid,
    heldAt: input.heldAt,
    mode: input.mode,
    notes: input.notes,
    needsAssessment: input.needsAssessment,
    recommendation: input.recommendation,
    outcome: input.outcome,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return ref.id;
}

export async function leadExists(leadId: string): Promise<boolean> {
  const snap = await adminDb().collection('leads').doc(leadId).get();
  return snap.exists;
}

export async function programmeExists(programmeId: string): Promise<boolean> {
  const snap = await adminDb().collection('programmes').doc(programmeId).get();
  return snap.exists;
}

/** Moves the lead onto the counselling stage so the pipeline reflects the session. */
export async function markLeadCounselled(
  leadId: string,
  outcome: SessionOutcome,
  actorUid: string,
): Promise<void> {
  // A `recommended` session is what the admissions queue filters on; the other
  // outcomes leave the lead where the consultant can still work it.
  const stage = outcome === 'recommended' ? 'hot' : 'counselling_attended';
  await adminDb().collection('leads').doc(leadId).update({
    stage,
    updatedAt: new Date(),
    updatedBy: actorUid,
  });
}
