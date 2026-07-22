import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type {
  AttendanceRiskInput,
  BatchUtilisationInput,
  CounsellingConversionInput,
  DuplicateSuspectInput,
  LeadSourceInput,
  PlacementFunnelInput,
} from './logic';

/**
 * Raw loaders for the reports centre (S42).
 *
 * Same discipline as the dashboard (Doc 11 §1): counts are `count()`
 * aggregations where possible, and document scans carry an explicit cap.
 * When a report outgrows the cap the fix is a scheduled precompute into
 * `stats`, not a bigger scan on the request path.
 */

const SCAN_CAP = 1_000;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function toIso(value: unknown): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : '';
}

async function safeCount(build: () => FirebaseFirestore.Query): Promise<number> {
  try {
    const snap = await build().count().get();
    return snap.data().count;
  } catch {
    // A missing composite index must not take a whole report down.
    return 0;
  }
}

export async function loadBatchUtilisation(): Promise<BatchUtilisationInput[]> {
  const db = adminDb();
  const [batches, programmes] = await Promise.all([
    db.collection('batches').limit(SCAN_CAP).get(),
    db.collection('programmes').get(),
  ]);

  const programmeNames = new Map(programmes.docs.map((d) => [d.id, asString(d.get('name'))]));

  return batches.docs.map((doc) => ({
    batchName: asString(doc.get('code')) || doc.id,
    programmeName: programmeNames.get(asString(doc.get('programmeId'))) ?? '—',
    status: asString(doc.get('status')),
    enrolled: asNumber(doc.get('enrolledCount')),
    capacity: asNumber(doc.get('capacity')),
  }));
}

export async function loadAttendanceRisk(): Promise<AttendanceRiskInput[]> {
  const db = adminDb();
  const [enrolments, batches, programmes, participants] = await Promise.all([
    db.collectionGroup('enrolments').limit(SCAN_CAP).get(),
    db.collection('batches').get(),
    db.collection('programmes').get(),
    db.collection('participants').limit(SCAN_CAP).get(),
  ]);

  const batchInfo = new Map(
    batches.docs.map((d) => [
      d.id,
      { name: asString(d.get('code')) || d.id, status: asString(d.get('status')) },
    ]),
  );
  const requiredPct = new Map(
    programmes.docs.map((d) => {
      const rules = (d.get('certificateRules') ?? {}) as Record<string, unknown>;
      return [d.id, asNumber(rules.minAttendancePct)];
    }),
  );
  const names = new Map(
    participants.docs.map((d) => {
      const personal = (d.get('personal') ?? {}) as Record<string, unknown>;
      return [d.id, asString(personal.fullName)];
    }),
  );

  return enrolments.docs.flatMap((doc) => {
    const batchId = asString(doc.get('batchId'));
    const batch = batchInfo.get(batchId);
    if (!batch) return [];

    // The participant ID is the parent of the enrolments subcollection.
    const participantId = doc.ref.parent.parent?.id ?? '';

    return [
      {
        participantName: names.get(participantId) ?? participantId,
        participantId,
        batchName: batch.name,
        batchRunning: batch.status === 'running',
        attendancePct: asNumber(doc.get('attendancePct')),
        requiredPct: requiredPct.get(asString(doc.get('programmeId'))) ?? 0,
      },
    ];
  });
}

export async function loadLeadSources(): Promise<LeadSourceInput[]> {
  const snap = await adminDb().collection('leads').limit(SCAN_CAP).get();
  return snap.docs.map((doc) => ({
    source: asString(doc.get('source')) || 'unknown',
    admitted: asString(doc.get('stage')) === 'admitted',
  }));
}

export async function loadCounsellingConversion(): Promise<CounsellingConversionInput> {
  const db = adminDb();

  const [counselled, admitted] = await Promise.all([
    safeCount(() =>
      db.collection('leads').where('stage', 'in', ['counselling_attended', 'hot', 'admitted']),
    ),
    safeCount(() => db.collection('leads').where('stage', '==', 'admitted')),
  ]);

  // BR-02's always-zero check: every admitted lead must have a counselling
  // session recommending them. Both sides are read in bulk rather than
  // per-lead — a read per admission would be an N+1 on the request path.
  const [admittedLeads, sessions] = await Promise.all([
    db.collection('leads').where('stage', '==', 'admitted').limit(SCAN_CAP).get(),
    db
      .collection('counsellingSessions')
      .where('outcome', '==', 'recommended')
      .limit(SCAN_CAP)
      .get(),
  ]);

  const recommendedLeadIds = new Set(
    sessions.docs
      .filter((doc) => doc.get('recommendation') !== null)
      .map((doc) => asString(doc.get('leadId'))),
  );

  const admittedWithoutCounselling = admittedLeads.docs.filter(
    (doc) => !recommendedLeadIds.has(doc.id),
  ).length;

  return { counselled, admitted, admittedWithoutCounselling };
}

export async function loadAlumniMemberSince(): Promise<string[]> {
  const snap = await adminDb().collection('alumniRecords').limit(SCAN_CAP).get();
  return snap.docs.map((doc) => toIso(doc.get('memberSince')));
}

export async function loadDuplicateSuspects(): Promise<DuplicateSuspectInput[]> {
  const snap = await adminDb().collection('leads').limit(SCAN_CAP).get();
  return snap.docs.map((doc) => ({
    phone: asString(doc.get('phone')),
    name: asString(doc.get('name')),
    converted: asString(doc.get('stage')) === 'admitted',
  }));
}

export async function loadPlacementFunnel(): Promise<PlacementFunnelInput> {
  const db = adminDb();
  const [evaluated, eligible, placed] = await Promise.all([
    safeCount(() =>
      db.collection('careerProfiles').where('eligibility', 'in', ['eligible', 'not_eligible']),
    ),
    safeCount(() => db.collection('careerProfiles').where('eligibility', '==', 'eligible')),
    safeCount(() => db.collection('placements').where('status', '==', 'placed')),
  ]);
  return { evaluated, eligible, placed };
}
