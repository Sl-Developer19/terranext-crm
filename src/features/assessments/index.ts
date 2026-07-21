/** Public API of the assessments feature (Doc 02 §3). */
export { AssessmentDialog } from './components/assessment-dialog';
export { AssessmentsTable } from './components/assessments-table';
export { ScoreGrid } from './components/score-grid';
export { getAssessment, getParticipantScores, getScoreGrid, listAssessments } from './queries';
export { meetsAssessmentThreshold, summarizeAttempts } from './logic';
export type { Assessment, ParticipantScoreEntry, ScoreRow } from './schema';
