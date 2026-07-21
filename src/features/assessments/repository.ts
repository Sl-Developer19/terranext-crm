import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentSnapshot, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { deriveResult, summarizeAttempts, type ScoredAttempt } from './logic';
import type { Assessment, ParticipantScoreEntry, ScoreRecord } from './schema';

/** Assessment data access (Doc 03 §1.5). Actions own permission + audit. */

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toAssessment(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  batchCode: string | null,
  scoredCount: number,
): Assessment {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    batchId: asString(data.batchId),
    batchCode,
    programmeId: asString(data.programmeId),
    name: asString(data.name),
    maxScore: asNumber(data.maxScore),
    passScore: asNumber(data.passScore),
    heldAt: asString(data.heldAt),
    scoredCount,
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findAssessments(batchId?: string): Promise<Assessment[]> {
  const db = adminDb();
  let query = db.collection('assessments').where('deletedAt', '==', null);
  if (batchId) query = query.where('batchId', '==', batchId);

  const [snap, batches] = await Promise.all([
    query.orderBy('heldAt', 'desc').limit(200).get(),
    db.collection('batches').get(),
  ]);
  const codes = new Map(batches.docs.map((d) => [d.id, asString(d.get('code'))]));

  return Promise.all(
    snap.docs.map(async (doc) => {
      const scores = await doc.ref.collection('scores').count().get();
      return toAssessment(
        doc,
        codes.get(asString(doc.get('batchId'))) ?? null,
        scores.data().count,
      );
    }),
  );
}

export async function findAssessmentById(assessmentId: string): Promise<Assessment | null> {
  const snap = await adminDb().collection('assessments').doc(assessmentId).get();
  if (!snap.exists || snap.get('deletedAt') !== null) return null;

  const batchId = asString(snap.get('batchId'));
  const [batch, scores] = await Promise.all([
    adminDb().collection('batches').doc(batchId).get(),
    snap.ref.collection('scores').count().get(),
  ]);

  return toAssessment(snap, batch.exists ? asString(batch.get('code')) : null, scores.data().count);
}

export async function findScores(assessmentId: string): Promise<ScoreRecord[]> {
  const snap = await adminDb()
    .collection('assessments')
    .doc(assessmentId)
    .collection('scores')
    .get();

  return snap.docs.map((doc) => ({
    participantId: doc.id,
    score: asNumber(doc.get('score')),
    result: doc.get('result') as 'pass' | 'fail',
    enteredBy: asString(doc.get('enteredBy')),
    enteredAt: toIso(doc.get('enteredAt')) ?? '',
  }));
}

/** A participant's scores across every assessment (collection-group read). */
export async function findParticipantScores(
  participantId: string,
): Promise<ParticipantScoreEntry[]> {
  const db = adminDb();
  const snap = await db
    .collectionGroup('scores')
    .where('participantId', '==', participantId)
    .limit(200)
    .get();

  const entries = await Promise.all(
    snap.docs.map(async (doc) => {
      const assessmentRef = doc.ref.parent.parent;
      if (!assessmentRef) return null;
      const assessment = await assessmentRef.get();
      if (!assessment.exists) return null;
      return {
        assessmentId: assessment.id,
        assessmentName: asString(assessment.get('name')),
        score: asNumber(doc.get('score')),
        maxScore: asNumber(assessment.get('maxScore')),
        result: doc.get('result') as 'pass' | 'fail',
        heldAt: asString(assessment.get('heldAt')),
      };
    }),
  );

  return entries
    .filter((entry): entry is ParticipantScoreEntry => entry !== null)
    .sort((a, b) => b.heldAt.localeCompare(a.heldAt));
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface AssessmentWriteModel {
  batchId: string;
  programmeId: string;
  name: string;
  maxScore: number;
  passScore: number;
  heldAt: string;
}

export async function createAssessmentRecord(
  input: AssessmentWriteModel,
  actorUid: string,
  branchId: string,
): Promise<string> {
  const now = new Date();
  const ref = adminDb().collection('assessments').doc();
  await ref.set({
    schemaVersion: 1,
    branchId,
    ...input,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
    deletedAt: null,
    deletedBy: null,
  });
  return ref.id;
}

export async function updateAssessmentRecord(
  assessmentId: string,
  input: Omit<AssessmentWriteModel, 'batchId' | 'programmeId'>,
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection('assessments')
    .doc(assessmentId)
    .update({ ...input, updatedAt: new Date(), updatedBy: actorUid });
}

export interface ScoreEntry {
  participantId: string;
  score: number | null;
}

/**
 * Writes scores with the pass/fail verdict derived server-side, then
 * recomputes each participant's `assessmentSummary` from ALL their attempts.
 *
 * Same discipline as attendance: full recompute, never increment, so a
 * corrected score heals the summary instead of leaving it drifted. The
 * summary is display-only — certificate issuance recomputes from raw scores
 * in-transaction (condition C-2).
 */
export async function enterAssessmentScores(
  assessmentId: string,
  passScore: number,
  entries: readonly ScoreEntry[],
  actorUid: string,
): Promise<void> {
  const db = adminDb();
  const scoresRef = db.collection('assessments').doc(assessmentId).collection('scores');
  const now = new Date();

  const batch = db.batch();
  for (const entry of entries) {
    const ref = scoresRef.doc(entry.participantId);
    if (entry.score === null) {
      // Clearing a mis-entry, which is not the same as recording a zero.
      batch.delete(ref);
      continue;
    }
    batch.set(
      ref,
      {
        schemaVersion: 1,
        participantId: entry.participantId,
        score: entry.score,
        // Derived here, never accepted from the client.
        result: deriveResult(entry.score, passScore),
        enteredBy: actorUid,
        enteredAt: now,
      },
      { merge: true },
    );
  }
  await batch.commit();

  await Promise.all(
    entries.map((entry) => recomputeAssessmentSummary(entry.participantId, assessmentId)),
  );
}

/**
 * Recomputes `enrolments.assessmentSummary` for the participant, scoped to
 * the enrolment whose batch this assessment belongs to.
 */
export async function recomputeAssessmentSummary(
  participantId: string,
  assessmentId: string,
): Promise<void> {
  const db = adminDb();

  const assessment = await db.collection('assessments').doc(assessmentId).get();
  if (!assessment.exists) return;
  const batchId = asString(assessment.get('batchId'));

  // Every assessment for this batch, so the summary reflects the whole
  // programme of assessments rather than only the one just entered.
  const batchAssessments = await db.collection('assessments').where('batchId', '==', batchId).get();

  const attempts: ScoredAttempt[] = [];
  await Promise.all(
    batchAssessments.docs.map(async (doc) => {
      const score = await doc.ref.collection('scores').doc(participantId).get();
      if (!score.exists) return;
      attempts.push({
        score: asNumber(score.get('score')),
        maxScore: asNumber(doc.get('maxScore')),
        result: score.get('result') as 'pass' | 'fail',
      });
    }),
  );

  const summary = summarizeAttempts(attempts);

  const enrolments = await db
    .collection('participants')
    .doc(participantId)
    .collection('enrolments')
    .where('batchId', '==', batchId)
    .get();

  await Promise.all(
    enrolments.docs.map((doc) =>
      doc.ref.update({ assessmentSummary: summary, updatedAt: new Date() }),
    ),
  );
}
