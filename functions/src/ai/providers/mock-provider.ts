import type { SpeechProvider, SummaryProvider, SummaryResult, TranscriptionResult } from './types';

/**
 * Zero-credential fallback. Keeps the full pipeline — queue, stages,
 * Firestore writes, dashboard, retry — genuinely exercisable end to end
 * before a real speech/summarization API key is supplied, per the "do not
 * stop development for missing credentials" directive. Selected
 * automatically by `factory.ts` whenever the configured provider has no key.
 */

export class MockSpeechProvider implements SpeechProvider {
  readonly name = 'mock';

  async transcribe(input: { sessionTitle: string }): Promise<TranscriptionResult> {
    const text =
      `No speech-to-text provider is configured for "${input.sessionTitle}" yet. ` +
      'Set the OPENAI_API_KEY secret to enable real transcription.';
    return {
      fullText: text,
      language: 'en',
      segments: [
        {
          speaker: 'unknown',
          speakerLabel: 'Unconfigured',
          text,
          startSec: 0,
          endSec: 0,
          attributionSource: 'heuristic',
          channelIndex: null,
        },
      ],
    };
  }
}

export class MockSummaryProvider implements SummaryProvider {
  readonly name = 'mock';

  async summarize(input: { sessionTitle: string }): Promise<SummaryResult> {
    return {
      executiveSummary:
        `AI analysis is not yet available for "${input.sessionTitle}". ` +
        'Set the OPENAI_API_KEY secret to enable it.',
      keyLearningPoints: [],
      importantQuestions: [],
      actionItems: [],
      trainerDiscussion: '',
      studentParticipation: '',
      importantObservations: [],
      followUpRequired: [],
      participantInsights: [],
    };
  }
}
