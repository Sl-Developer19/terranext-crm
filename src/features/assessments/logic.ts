/**
 * Pure assessment rules (no I/O).
 *
 * Pass/fail and the assessment summary are computed here and only here.
 * The client never sends a result — it sends a score, and the server derives
 * the verdict, so a tampered request cannot manufacture a pass that BR-03
 * would later honour.
 */

export type ScoreResult = 'pass' | 'fail';

/** A score meets the bar when it reaches the pass mark, inclusive. */
export function deriveResult(score: number, passScore: number): ScoreResult {
  return score >= passScore ? 'pass' : 'fail';
}

/** A score outside 0..maxScore is a data-entry error, not a low mark. */
export function isScoreInRange(score: number, maxScore: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= maxScore;
}

export interface AssessmentSummary {
  attempted: number;
  passed: number;
  /** Mean percentage across attempted assessments, whole number 0–100. */
  avgScore: number;
}

export interface ScoredAttempt {
  score: number;
  maxScore: number;
  result: ScoreResult;
}

/**
 * Rolls a participant's attempts into the summary stored on their enrolment.
 *
 * `avgScore` is a mean of PERCENTAGES, not of raw marks: averaging a 45/50
 * with a 60/100 as raw numbers would understate the first and overstate the
 * second. Percentages make assessments of different weights comparable,
 * which is what BR-03's `minAssessmentScore` threshold assumes.
 *
 * Full recompute from all attempts, like attendance — idempotent under
 * replay and self-healing after a corrected score.
 */
export function summarizeAttempts(attempts: readonly ScoredAttempt[]): AssessmentSummary {
  if (attempts.length === 0) return { attempted: 0, passed: 0, avgScore: 0 };

  const usable = attempts.filter((attempt) => attempt.maxScore > 0);
  if (usable.length === 0) {
    return { attempted: attempts.length, passed: 0, avgScore: 0 };
  }

  const percentageTotal = usable.reduce(
    (total, attempt) => total + (attempt.score / attempt.maxScore) * 100,
    0,
  );

  return {
    attempted: attempts.length,
    passed: attempts.filter((attempt) => attempt.result === 'pass').length,
    avgScore: Math.round(percentageTotal / usable.length),
  };
}

/**
 * BR-03's assessment half: has the participant met the programme's minimum
 * assessment score? Evaluated against the summary average.
 *
 * An unassessed participant returns false — never true by default. "Not yet
 * measured" must not read as "met the bar", or a certificate could be issued
 * to someone who never sat an assessment.
 */
export function meetsAssessmentThreshold(
  summary: AssessmentSummary,
  minAssessmentScore: number,
): boolean {
  if (summary.attempted === 0) return false;
  return summary.avgScore >= minAssessmentScore;
}
