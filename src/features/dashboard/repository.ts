import 'server-only';

import { adminDb } from '@/lib/firebase/admin';

import type { DashboardCounts } from './schema';

/**
 * Dashboard aggregates (SOP 15.9 / 18.10).
 *
 * Cost discipline: everything that can be a Firestore `count()` aggregation
 * is one. Aggregations bill per index entry scanned rather than per document
 * read, so the whole dashboard costs a small fraction of what fetching the
 * documents would — which matters because this is the landing page every
 * user hits on every session.
 *
 * The two figures that genuinely need documents (attendance mean, fee
 * totals) are bounded by an explicit cap. When the participant base outgrows
 * that cap the answer is a scheduled precompute into a `stats` document
 * (Doc 19 §4, SOP 18.10), not a larger scan on the request path.
 */

/** Beyond this, sampled figures are precomputed rather than scanned live. */
const SCAN_CAP = 1_000;

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function safeCount(build: () => FirebaseFirestore.Query): Promise<number> {
  try {
    const snap = await build().count().get();
    return snap.data().count;
  } catch {
    // A missing composite index or an empty collection must degrade to 0
    // rather than take the whole dashboard down — one metric failing should
    // not deny a user their landing page.
    return 0;
  }
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function loadDashboardCounts(): Promise<DashboardCounts> {
  const db = adminDb();
  const monthStart = startOfMonth();

  const [
    leadsTotal,
    leadsAdmitted,
    participantsTotal,
    participantsActive,
    participantsCompleted,
    admissionsThisMonth,
    batchesActive,
    batchesTotal,
    certificatesIssued,
    alumniTotal,
    familiesTotal,
    familiesConverted,
    trainersTotal,
    assessmentsTotal,
    gpTotalPartners,
    gpActivePartners,
    gpTotalReferrals,
    gpAdmittedReferrals,
  ] = await Promise.all([
    safeCount(() => db.collection('leads').where('deletedAt', '==', null)),
    safeCount(() =>
      db.collection('leads').where('deletedAt', '==', null).where('stage', '==', 'admitted'),
    ),
    safeCount(() => db.collection('participants').where('deletedAt', '==', null)),
    safeCount(() =>
      db.collection('participants').where('deletedAt', '==', null).where('status', '==', 'active'),
    ),
    safeCount(() =>
      db
        .collection('participants')
        .where('deletedAt', '==', null)
        .where('status', '==', 'completed'),
    ),
    safeCount(() =>
      db
        .collection('participants')
        .where('deletedAt', '==', null)
        .where('createdAt', '>=', monthStart),
    ),
    safeCount(() =>
      db.collection('batches').where('deletedAt', '==', null).where('status', '==', 'running'),
    ),
    safeCount(() => db.collection('batches').where('deletedAt', '==', null)),
    safeCount(() => db.collection('certificates').where('status', '==', 'issued')),
    safeCount(() => db.collection('alumniRecords')),
    safeCount(() => db.collection('families').where('deletedAt', '==', null)),
    safeCount(() =>
      db
        .collection('families')
        .where('deletedAt', '==', null)
        .where('conversionStatus', 'in', ['lead_created', 'enrolled']),
    ),
    safeCount(() =>
      db.collection('users').where('role', '==', 'trainer').where('status', '==', 'active'),
    ),
    safeCount(() => db.collection('assessments').where('deletedAt', '==', null)),
    safeCount(() => db.collection('growthPartners').where('deletedAt', '==', null)),
    safeCount(() =>
      db
        .collection('growthPartners')
        .where('deletedAt', '==', null)
        .where('status', '==', 'active'),
    ),
    safeCount(() =>
      db.collection('leads').where('deletedAt', '==', null).where('partnerId', '!=', null),
    ),
    safeCount(() =>
      db
        .collection('leads')
        .where('deletedAt', '==', null)
        .where('partnerId', '!=', null)
        .where('stage', '==', 'admitted'),
    ),
  ]);

  const [
    alumniThisMonth,
    parentSessionsTotal,
    trainersAssigned,
    assessmentsScored,
    attendance,
    revenue,
    gpRewards,
  ] = await Promise.all([
    safeCount(() => db.collection('alumniRecords').where('memberSince', '>=', monthStart)),
    // `batches/{id}/sessions` (delivery sessions) and `families/{id}/sessions`
    // (parent counselling) share the subcollection id "sessions", so a bare
    // collectionGroup count would silently merge the two. `outcome` exists
    // only on parent-counselling sessions — Firestore excludes documents
    // missing a field from an `in` filter, which is what disambiguates them.
    safeCount(() =>
      db
        .collectionGroup('sessions')
        .where('outcome', 'in', ['recommended', 'follow_up', 'not_interested']),
    ),
    countAssignedTrainers(),
    countScoredAssessments(),
    meanAttendance(),
    revenueTotals(),
    growthPartnerRewardTotals(),
  ]);

  return {
    leadsTotal,
    leadsAdmitted,
    participantsTotal,
    participantsActive,
    participantsCompleted,
    admissionsThisMonth,
    batchesActive,
    batchesTotal,
    certificatesIssued,
    alumniTotal,
    alumniThisMonth,
    parentSessionsTotal,
    familiesTotal,
    familiesConverted,
    trainersTotal,
    trainersAssigned,
    assessmentsTotal,
    assessmentsScored,
    attendancePctMean: attendance.mean,
    attendanceSampleSize: attendance.sampleSize,
    revenuePaisePaid: revenue.paid,
    revenuePaiseOutstanding: revenue.outstanding,
    gpTotalPartners,
    gpActivePartners,
    gpTotalReferrals,
    gpAdmittedReferrals,
    gpRewardsAccruedPaise: gpRewards.accrued,
    gpRewardsPaidPaise: gpRewards.paid,
  };
}

/**
 * Distinct trainers currently running a planned or live batch — the
 * denominator-friendly reading of "trainer utilisation" (SOP 18.10).
 * Counts people, not batches, so one trainer on three batches is still one
 * utilised trainer.
 */
async function countAssignedTrainers(): Promise<number> {
  try {
    const snap = await adminDb()
      .collection('batches')
      .where('deletedAt', '==', null)
      .where('status', 'in', ['planned', 'running'])
      .select('trainerUid')
      .limit(SCAN_CAP)
      .get();

    const trainers = new Set<string>();
    for (const doc of snap.docs) {
      const uid = doc.get('trainerUid');
      if (typeof uid === 'string' && uid !== '') trainers.add(uid);
    }
    return trainers.size;
  } catch {
    return 0;
  }
}

/** Assessments with at least one score entered (SOP 15.9 assessment completion). */
async function countScoredAssessments(): Promise<number> {
  try {
    const snap = await adminDb()
      .collection('assessments')
      .where('deletedAt', '==', null)
      .limit(SCAN_CAP)
      .get();

    const results = await Promise.all(
      snap.docs.map(async (doc) => {
        const scores = await doc.ref.collection('scores').count().get();
        return scores.data().count > 0 ? 1 : 0;
      }),
    );
    return results.reduce<number>((total, value) => total + value, 0);
  } catch {
    return 0;
  }
}

/**
 * Mean attendance across enrolments that actually have attendance recorded.
 *
 * Enrolments with no marks are excluded from the sample rather than counted
 * as 0% — including them would drag the organisation-wide figure down purely
 * because a batch has not started yet, which is not an attendance problem.
 */
async function meanAttendance(): Promise<{ mean: number; sampleSize: number }> {
  try {
    const snap = await adminDb()
      .collectionGroup('enrolments')
      .select('attendancePct', 'batchId')
      .limit(SCAN_CAP)
      .get();

    const values = snap.docs
      .map((doc) => asNumber(doc.get('attendancePct')))
      .filter((pct) => pct > 0);

    if (values.length === 0) return { mean: 0, sampleSize: 0 };
    const total = values.reduce((sum, pct) => sum + pct, 0);
    return { mean: Math.round(total / values.length), sampleSize: values.length };
  } catch {
    return { mean: 0, sampleSize: 0 };
  }
}

/** Collected and outstanding totals in integer paise (ADR-012). */
async function revenueTotals(): Promise<{ paid: number; outstanding: number }> {
  try {
    const snap = await adminDb()
      .collection('feeAccounts')
      .select('paidPaise', 'balancePaise')
      .limit(SCAN_CAP)
      .get();

    let paid = 0;
    let outstanding = 0;
    for (const doc of snap.docs) {
      paid += asNumber(doc.get('paidPaise'));
      outstanding += asNumber(doc.get('balancePaise'));
    }
    return { paid, outstanding };
  } catch {
    return { paid: 0, outstanding: 0 };
  }
}

/** Doc 25 §6/§13 — reward ledger totals, same bounded-scan discipline as revenueTotals(). */
async function growthPartnerRewardTotals(): Promise<{ accrued: number; paid: number }> {
  try {
    const snap = await adminDb()
      .collection('rewardLedger')
      .select('amountPaise', 'status')
      .limit(SCAN_CAP)
      .get();

    let accrued = 0;
    let paid = 0;
    for (const doc of snap.docs) {
      if (doc.get('status') === 'paid') paid += asNumber(doc.get('amountPaise'));
      else accrued += asNumber(doc.get('amountPaise'));
    }
    return { accrued, paid };
  } catch {
    return { accrued: 0, paid: 0 };
  }
}
