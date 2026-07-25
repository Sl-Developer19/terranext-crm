import 'server-only';

import { randomBytes } from 'node:crypto';

import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import type { ScoredAttempt } from '@/features/assessments/logic';
import type { AttendanceStatus } from '@/features/attendance/schema';
import { adminDb } from '@/lib/firebase/admin';

import { evaluateEligibility, formatCertificateNo, type EligibilityVerdict } from './logic';
import type { Certificate, CertificateStatus, VerificationResult } from './schema';

/** Certificate data access (Doc 03 §1.5, BR-03/BR-05). */

const COUNTER_ID = 'certificateNo';
const DEFAULT_PREFIX = 'TNXC';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toCertificate(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  participantName: string | null,
  programmeName: string | null,
): Certificate {
  const data = doc.data() ?? {};
  const criteria = (data.criteria ?? {}) as Record<string, unknown>;
  return {
    id: doc.id,
    participantId: asString(data.participantId),
    participantName,
    enrolmentId: asString(data.enrolmentId),
    programmeId: asString(data.programmeId),
    programmeName,
    batchId: asStringOrNull(data.batchId),
    issuedAt: toIso(data.issuedAt) ?? '',
    issuedBy: asString(data.issuedBy),
    criteria: {
      attendancePct: asNumber(criteria.attendancePct),
      minAttendanceRequired: asNumber(criteria.minAttendanceRequired),
      assessmentAvgScore: asNumber(criteria.assessmentAvgScore),
      minAssessmentRequired: asNumber(criteria.minAssessmentRequired),
      assessmentPassed: criteria.assessmentPassed === true,
    },
    status: (data.status as CertificateStatus) ?? 'issued',
    revokedReason: asStringOrNull(data.revokedReason),
    revokedAt: toIso(data.revokedAt),
    verifyHash: asString(data.verifyHash),
  };
}

/* ── Raw evidence gathering (condition C-2) ────────────────────────────── */

/**
 * Loads the RAW evidence BR-03 is evaluated against — individual attendance
 * marks and individual scores, never the denormalized roll-ups. This is the
 * function that makes C-2 true: everything downstream of it sees facts, not
 * cached summaries.
 */
export async function loadEligibilityEvidence(
  participantId: string,
  batchId: string,
): Promise<{ attendanceStatuses: AttendanceStatus[]; attempts: ScoredAttempt[] }> {
  const db = adminDb();

  const [attendance, assessments] = await Promise.all([
    db
      .collectionGroup('attendance')
      .where('participantId', '==', participantId)
      .where('batchId', '==', batchId)
      .get(),
    db.collection('assessments').where('batchId', '==', batchId).get(),
  ]);

  const attempts: ScoredAttempt[] = [];
  await Promise.all(
    assessments.docs.map(async (assessment) => {
      const score = await assessment.ref.collection('scores').doc(participantId).get();
      if (!score.exists) return;
      attempts.push({
        score: asNumber(score.get('score')),
        maxScore: asNumber(assessment.get('maxScore')),
        result: score.get('result') as 'pass' | 'fail',
      });
    }),
  );

  return {
    attendanceStatuses: attendance.docs.map((d) => d.get('status') as AttendanceStatus),
    attempts,
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

/** Resolves only the participant/programme ids actually referenced — never a full collection scan. */
async function nameMaps(participantIds: Iterable<string>, programmeIds: Iterable<string>) {
  const db = adminDb();
  const uniqueParticipants = [...new Set(participantIds)].filter((id) => id.length > 0);
  const uniqueProgrammes = [...new Set(programmeIds)].filter((id) => id.length > 0);

  const [participantDocs, programmeDocs] = await Promise.all([
    Promise.all(uniqueParticipants.map((id) => db.collection('participants').doc(id).get())),
    Promise.all(uniqueProgrammes.map((id) => db.collection('programmes').doc(id).get())),
  ]);

  return {
    participants: new Map(
      participantDocs.map((d) => {
        const personal = (d.get('personal') ?? {}) as Record<string, unknown>;
        return [d.id, asString(personal.fullName)];
      }),
    ),
    programmes: new Map(programmeDocs.map((d) => [d.id, asString(d.get('name'))])),
  };
}

export async function findCertificates(): Promise<Certificate[]> {
  const snap = await adminDb()
    .collection('certificates')
    .orderBy('issuedAt', 'desc')
    .limit(200)
    .get();
  const names = await nameMaps(
    snap.docs.map((d) => asString(d.get('participantId'))),
    snap.docs.map((d) => asString(d.get('programmeId'))),
  );
  return snap.docs.map((doc) =>
    toCertificate(
      doc,
      names.participants.get(asString(doc.get('participantId'))) ?? null,
      names.programmes.get(asString(doc.get('programmeId'))) ?? null,
    ),
  );
}

export async function findCertificateById(certificateId: string): Promise<Certificate | null> {
  const snap = await adminDb().collection('certificates').doc(certificateId).get();
  if (!snap.exists) return null;
  const names = await nameMaps(
    [asString(snap.get('participantId'))],
    [asString(snap.get('programmeId'))],
  );
  return toCertificate(
    snap,
    names.participants.get(asString(snap.get('participantId'))) ?? null,
    names.programmes.get(asString(snap.get('programmeId'))) ?? null,
  );
}

export async function findCertificateForEnrolment(
  participantId: string,
  enrolmentId: string,
): Promise<Certificate | null> {
  const snap = await adminDb()
    .collection('certificates')
    .where('participantId', '==', participantId)
    .where('enrolmentId', '==', enrolmentId)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  return toCertificate(doc, null, null);
}

/**
 * Public verification lookup. Returns programme and issuance facts only —
 * no participant identity of any kind (Doc 19 `verifyCertificate`).
 */
export async function verifyCertificate(
  certificateNo: string,
  hash: string,
): Promise<VerificationResult> {
  const snap = await adminDb().collection('certificates').doc(certificateNo).get();
  // A wrong number and a wrong hash produce the same answer — the endpoint
  // must not confirm that a certificate number exists.
  if (!snap.exists || asString(snap.get('verifyHash')) !== hash) return { valid: false };

  const programmeId = asString(snap.get('programmeId'));
  const programme = await adminDb().collection('programmes').doc(programmeId).get();
  const status = (snap.get('status') as CertificateStatus) ?? 'issued';

  const programmeName = programme.exists ? asString(programme.get('name')) : '';
  const issuedAt = toIso(snap.get('issuedAt'));

  return {
    valid: status === 'issued',
    certificateNo: snap.id,
    ...(programmeName ? { programmeName } : {}),
    ...(issuedAt ? { issuedAt } : {}),
    status,
  };
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface IssueCertificateRecord {
  participantId: string;
  enrolmentId: string;
  programmeId: string;
  batchId: string | null;
  minAttendancePct: number;
  minAssessmentScore: number;
  actorUid: string;
  branchId: string;
  /** Ops override: issue despite failing criteria, with the reason recorded. */
  override: boolean;
}

export type IssueOutcome =
  | { kind: 'issued'; certificateId: string; verdict: EligibilityVerdict }
  | { kind: 'not_eligible'; verdict: EligibilityVerdict }
  | { kind: 'already_issued'; certificateId: string };

/**
 * Issues a certificate (Doc 19 `issueCertificateAction`, condition C-2).
 *
 * The order matters and is the whole point:
 *   1. load RAW evidence (attendance marks, scores) — not roll-ups
 *   2. re-evaluate BR-03 against it
 *   3. inside a transaction: re-check no certificate exists, mint the
 *      number from the counter, write the certificate with the evidence
 *      snapshot frozen in
 *
 * Steps 1–2 happen outside the transaction because they are collection-group
 * reads that Firestore transactions cannot perform. That is safe here: the
 * transaction re-checks the only invariant that a concurrent writer could
 * break (a duplicate certificate for the same enrolment). Attendance or
 * scores changing between step 1 and step 3 would at worst issue against
 * evidence a few seconds stale — and the snapshot records exactly which
 * evidence was used, so the decision is auditable after the fact.
 */
export async function issueCertificate(record: IssueCertificateRecord): Promise<IssueOutcome> {
  const db = adminDb();

  const evidence = await loadEligibilityEvidence(record.participantId, record.batchId ?? '');
  const verdict = evaluateEligibility({
    ...evidence,
    minAttendancePct: record.minAttendancePct,
    minAssessmentScore: record.minAssessmentScore,
  });

  if (!verdict.eligible && !record.override) {
    return { kind: 'not_eligible', verdict };
  }

  const now = new Date();
  const counterRef = db.collection('counters').doc(COUNTER_ID);
  const enrolmentRef = db
    .collection('participants')
    .doc(record.participantId)
    .collection('enrolments')
    .doc(record.enrolmentId);

  return db.runTransaction(async (tx) => {
    // Re-check inside the transaction: two coordinators clicking Issue at
    // the same moment must not mint two certificates for one enrolment.
    const enrolmentSnap = await tx.get(enrolmentRef);
    const existing = asStringOrNull(enrolmentSnap.get('certificateId'));
    if (existing) return { kind: 'already_issued', certificateId: existing };

    const counterSnap = await tx.get(counterRef);
    const prefix =
      (counterSnap.exists ? asStringOrNull(counterSnap.get('prefix')) : null) ?? DEFAULT_PREFIX;
    const next = (counterSnap.exists ? asNumber(counterSnap.get('current')) : 0) + 1;
    const certificateId = formatCertificateNo(prefix, now.getFullYear(), next);

    tx.set(counterRef, { current: next, prefix, year: now.getFullYear() }, { merge: true });

    tx.set(db.collection('certificates').doc(certificateId), {
      schemaVersion: 1,
      branchId: record.branchId,
      participantId: record.participantId,
      enrolmentId: record.enrolmentId,
      programmeId: record.programmeId,
      batchId: record.batchId,
      issuedAt: now,
      issuedBy: record.actorUid,
      // Frozen evidence snapshot: what was true, and what was required, at
      // the moment of issuance (Doc 14 §13).
      criteria: {
        attendancePct: verdict.attendancePct,
        minAttendanceRequired: record.minAttendancePct,
        assessmentAvgScore: verdict.assessmentAvgScore,
        minAssessmentRequired: record.minAssessmentScore,
        assessmentPassed: verdict.assessmentPassed,
      },
      status: 'issued',
      revokedReason: null,
      revokedAt: null,
      overridden: record.override && !verdict.eligible,
      verifyHash: randomBytes(16).toString('hex'),
      createdAt: now,
      createdBy: record.actorUid,
      updatedAt: now,
      updatedBy: record.actorUid,
    });

    tx.update(enrolmentRef, {
      certificateId,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
      updatedBy: record.actorUid,
    });

    tx.set(db.collection('participants').doc(record.participantId).collection('timeline').doc(), {
      type: 'certificate_issued',
      refPath: `certificates/${certificateId}`,
      summary: `Certificate ${certificateId} issued`,
      at: now,
      byUid: record.actorUid,
    });

    return { kind: 'issued', certificateId, verdict };
  });
}

/**
 * BR-05: certification creates the alumni record. Existence-checked before
 * create so a re-run is safe (the idempotency the trigger design requires).
 */
export async function ensureAlumniRecord(
  participantId: string,
  certificateId: string,
  actorUid: string,
  branchId: string,
): Promise<boolean> {
  const db = adminDb();
  const ref = db.collection('alumniRecords').doc(participantId);
  const existing = await ref.get();
  if (existing.exists) return false;

  const now = new Date();
  await ref.set({
    schemaVersion: 1,
    branchId,
    participantId,
    memberSince: now,
    triggeredByCertificateId: certificateId,
    engagement: { referrals: 0, eventsAttended: 0 },
    consentForSuccessStory: false,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });

  await db.collection('participants').doc(participantId).update({
    status: 'alumni',
    updatedAt: now,
    updatedBy: actorUid,
  });

  return true;
}

export async function revokeCertificateRecord(
  certificateId: string,
  reason: string,
  actorUid: string,
): Promise<void> {
  const now = new Date();
  await adminDb().collection('certificates').doc(certificateId).update({
    status: 'revoked',
    revokedReason: reason,
    revokedAt: now,
    updatedAt: now,
    updatedBy: actorUid,
  });
}
