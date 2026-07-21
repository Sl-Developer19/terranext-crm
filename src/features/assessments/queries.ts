import 'server-only';

import { listRoster } from '@/features/batches/queries';

import {
  findAssessmentById,
  findAssessments,
  findParticipantScores,
  findScores,
} from './repository';
import type { Assessment, ParticipantScoreEntry, ScoreRow } from './schema';

/** Read models for S26 (assessments + score entry). */

export async function listAssessments(batchId?: string): Promise<Assessment[]> {
  return findAssessments(batchId);
}

export async function getAssessment(assessmentId: string): Promise<Assessment | null> {
  return findAssessmentById(assessmentId);
}

/**
 * Score-entry grid: every roster member of the assessment's batch, joined
 * with any score already entered. Roster-driven so an unscored participant
 * still appears as a row rather than silently missing.
 */
export async function getScoreGrid(assessment: Assessment): Promise<ScoreRow[]> {
  const [roster, scores] = await Promise.all([
    listRoster(assessment.batchId),
    findScores(assessment.id),
  ]);

  const byParticipant = new Map(scores.map((score) => [score.participantId, score]));
  return roster.map((entry) => {
    const existing = byParticipant.get(entry.participantId);
    return {
      participantId: entry.participantId,
      participantName: entry.participantName,
      score: existing?.score ?? null,
      result: existing?.result ?? null,
    };
  });
}

export async function getParticipantScores(
  participantId: string,
): Promise<ParticipantScoreEntry[]> {
  return findParticipantScores(participantId);
}
