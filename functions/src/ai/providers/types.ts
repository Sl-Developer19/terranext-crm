/**
 * Provider abstraction (AI Session Intelligence Proposal). Business logic
 * (`process-session-job.ts`) depends only on these interfaces — never on a
 * concrete vendor — so the speech-to-text and summarization backends are
 * swappable via environment configuration (`factory.ts`) with zero changes
 * to the pipeline itself.
 */

export type SpeakerRole = 'trainer' | 'student' | 'unknown';

export interface TranscriptSegment {
  speaker: SpeakerRole;
  speakerLabel: string;
  text: string;
  startSec: number;
  endSec: number;
}

export interface TranscriptionResult {
  fullText: string;
  language: string;
  segments: TranscriptSegment[];
}

export interface SpeechProvider {
  readonly name: string;
  transcribe(input: {
    audioBuffer: Buffer;
    contentType: string;
    sessionTitle: string;
  }): Promise<TranscriptionResult>;
}

export interface SummaryResult {
  executiveSummary: string;
  keyLearningPoints: string[];
  importantQuestions: string[];
  actionItems: string[];
}

export interface SummaryProvider {
  readonly name: string;
  summarize(input: { transcriptText: string; sessionTitle: string }): Promise<SummaryResult>;
}
