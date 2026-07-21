import 'server-only';

import { findProgrammes } from '@/features/catalogue/repository';
import { adminDb } from '@/lib/firebase/admin';

import { evaluateEligibility } from './logic';
import { findCertificates, loadEligibilityEvidence } from './repository';
import type { Certificate, EligibilityRow } from './schema';

/** Read models for the certificate registry and eligibility queue (S27). */

export async function listCertificates(): Promise<Certificate[]> {
  return findCertificates();
}

/**
 * The eligibility queue: every in-progress or completed enrolment,
 * evaluated against BR-03 from RAW evidence (condition C-2).
 *
 * This is the expensive read in the system — a collection-group scan plus
 * per-participant evidence loads. It is bounded to enrolments that could
 * plausibly certify and capped, because an unbounded version would degrade
 * as the participant base grows. When that ceiling is reached the fix is a
 * scheduled precompute into a `stats` document (M8), not a bigger query.
 */
export async function listEligibilityQueue(limit = 100): Promise<EligibilityRow[]> {
  const db = adminDb();

  const [enrolments, programmes] = await Promise.all([
    db
      .collectionGroup('enrolments')
      .where('status', 'in', ['in_progress', 'completed'])
      .limit(limit)
      .get(),
    findProgrammes(),
  ]);

  const programmeById = new Map(programmes.map((p) => [p.id, p]));

  const rows = await Promise.all(
    enrolments.docs.map(async (doc): Promise<EligibilityRow | null> => {
      const participantRef = doc.ref.parent.parent;
      if (!participantRef) return null;

      const programmeId = String(doc.get('programmeId') ?? '');
      const programme = programmeById.get(programmeId);
      if (!programme) return null;

      const batchId = (doc.get('batchId') as string | null) ?? null;
      const participant = await participantRef.get();
      const personal = (participant.get('personal') ?? {}) as Record<string, unknown>;

      const evidence = await loadEligibilityEvidence(participant.id, batchId ?? '');
      const verdict = evaluateEligibility({
        ...evidence,
        minAttendancePct: programme.certificateRules.minAttendancePct,
        minAssessmentScore: programme.certificateRules.minAssessmentScore,
      });

      return {
        participantId: participant.id,
        participantName: typeof personal.fullName === 'string' ? personal.fullName : '',
        enrolmentId: doc.id,
        programmeId,
        programmeName: programme.name,
        batchId,
        attendancePct: verdict.attendancePct,
        minAttendanceRequired: programme.certificateRules.minAttendancePct,
        assessmentAvgScore: verdict.assessmentAvgScore,
        minAssessmentRequired: programme.certificateRules.minAssessmentScore,
        eligible: verdict.eligible,
        blockers: verdict.blockers,
        existingCertificateId: (doc.get('certificateId') as string | null) ?? null,
      };
    }),
  );

  return (
    rows
      .filter((row): row is EligibilityRow => row !== null)
      // Eligible-and-unissued first: that is the queue's actual job.
      .sort((a, b) => {
        const aActionable = a.eligible && !a.existingCertificateId ? 0 : 1;
        const bActionable = b.eligible && !b.existingCertificateId ? 0 : 1;
        if (aActionable !== bActionable) return aActionable - bActionable;
        return a.participantName.localeCompare(b.participantName);
      })
  );
}
