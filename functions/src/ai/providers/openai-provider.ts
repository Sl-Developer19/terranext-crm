import { extractJson, toSpeakerRole } from './json';
import type {
  SpeakerRole,
  SpeechProvider,
  SummaryProvider,
  SummaryResult,
  TranscriptionResult,
  TranscriptSegment,
} from './types';

/**
 * OpenAI implementation, called directly over REST (`fetch`): Whisper for
 * transcription, then a chat-completion classification pass over the
 * returned segments (Whisper itself has no speaker diarization) before a
 * second chat completion produces the summary.
 */

const API_BASE = 'https://api.openai.com/v1';

function extensionForContentType(contentType: string): string {
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('mpeg')) return 'mp3';
  if (contentType.includes('mp4')) return 'm4a';
  if (contentType.includes('ogg')) return 'ogg';
  return 'bin';
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

async function transcribeWithWhisper(
  apiKey: string,
  model: string,
  audioBuffer: Buffer,
  contentType: string,
): Promise<{ text: string; language: string; segments: WhisperSegment[] }> {
  const form = new FormData();
  form.append('model', model);
  // verbose_json is what returns the `segments` array with per-segment
  // start/end timestamps (default granularity when timestamp_granularities
  // is omitted) — only whisper-family models support this response format;
  // see the model-choice note in providers/factory.ts.
  form.append('response_format', 'verbose_json');
  form.append(
    'file',
    new Blob([new Uint8Array(audioBuffer)], { type: contentType }),
    `audio.${extensionForContentType(contentType)}`,
  );

  const response = await fetch(`${API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI transcription error ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    text?: string;
    language?: string;
    segments?: Array<{ start?: number; end?: number; text?: string }>;
  };

  return {
    text: payload.text ?? '',
    language: payload.language ?? 'en',
    segments: (payload.segments ?? []).map((s) => ({
      start: s.start ?? 0,
      end: s.end ?? 0,
      text: (s.text ?? '').trim(),
    })),
  };
}

async function chatCompletionJson(apiKey: string, model: string, prompt: string): Promise<unknown> {
  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI chat completion error ${response.status}: ${detail.slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('OpenAI chat completion returned no content.');
  return extractJson(content);
}

export class OpenAISpeechProvider implements SpeechProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    /** Whisper-family model for the actual `/audio/transcriptions` call — see factory.ts for why this stays whisper-1. */
    private readonly transcribeModel: string,
    /** Chat-completions model for the trainer/student classification pass (Whisper itself has no diarization). */
    private readonly classificationModel: string,
  ) {}

  async transcribe(input: {
    audioBuffer: Buffer;
    contentType: string;
    sessionTitle: string;
    knownSpeaker?: { role: SpeakerRole; label: string; channelIndex: number } | null;
  }): Promise<TranscriptionResult> {
    const whisper = await transcribeWithWhisper(
      this.apiKey,
      this.transcribeModel,
      input.audioBuffer,
      input.contentType,
    );

    if (whisper.segments.length === 0) {
      return { fullText: whisper.text, language: whisper.language, segments: [] };
    }

    // Real hardware channel identity beats any guess — skip the
    // text-classification pass entirely rather than let a heuristic
    // second-guess a known-correct answer (and waste an API call doing it).
    if (input.knownSpeaker) {
      const { role, label, channelIndex } = input.knownSpeaker;
      const segments: TranscriptSegment[] = whisper.segments.map((s) => ({
        speaker: role,
        speakerLabel: label,
        text: s.text,
        startSec: s.start,
        endSec: s.end,
        attributionSource: 'channel',
        channelIndex,
      }));
      return { fullText: whisper.text, language: whisper.language, segments };
    }

    const classificationPrompt =
      'Classify each numbered transcript segment from a classroom training session as ' +
      '"trainer" (leading instruction) or "student" (asking/answering), or "unknown" if unclear. ' +
      'Respond with ONLY JSON {"speakers":[{"index":<number>,"speaker":"trainer|student|unknown",' +
      '"speakerLabel":"<short label>"}]}.\n\n' +
      whisper.segments.map((s, i) => `${i}: ${s.text}`).join('\n');

    const classification = (await chatCompletionJson(
      this.apiKey,
      this.classificationModel,
      classificationPrompt,
    )) as {
      speakers?: Array<{ index?: number; speaker?: string; speakerLabel?: string }>;
    };
    const byIndex = new Map(
      (classification.speakers ?? []).map((s) => [s.index ?? -1, s] as const),
    );

    const segments: TranscriptSegment[] = whisper.segments.map((s, i) => {
      const label = byIndex.get(i);
      return {
        speaker: toSpeakerRole(label?.speaker),
        speakerLabel: label?.speakerLabel ?? 'Unknown speaker',
        text: s.text,
        startSec: s.start,
        endSec: s.end,
        attributionSource: 'heuristic',
        channelIndex: null,
      };
    });

    return { fullText: whisper.text, language: whisper.language, segments };
  }
}

export class OpenAISummaryProvider implements SummaryProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    /** Chat-completions model for executive summary / key points / questions / action items — see factory.ts for the cost/quality reasoning. */
    private readonly summaryModel: string,
  ) {}

  async summarize(input: { transcriptText: string; sessionTitle: string }): Promise<SummaryResult> {
    const prompt =
      `You are analysing the transcript of a classroom training session titled ` +
      `"${input.sessionTitle}". Produce a professional session summary grounded strictly in ` +
      'what the transcript actually contains. Respond with ONLY JSON in exactly this shape:\n' +
      '{"executiveSummary":"<2-4 sentence overview>",' +
      '"trainerDiscussion":"<narrative of what the trainer covered/explained>",' +
      '"studentParticipation":"<narrative of how students engaged — questions, answers, engagement level>",' +
      '"keyLearningPoints":["..."],' +
      '"importantQuestions":["..."],' +
      '"importantObservations":["<notable moments that are not a learning point or a question>"],' +
      '"actionItems":["..."],' +
      '"followUpRequired":["<concrete next steps implied but not phrased as a direct action item>"],' +
      '"participantInsights":["<per-student observation, ONLY if that student is identifiable in the transcript>"]}\n\n' +
      'Rules: use an empty string/array for any field with nothing genuinely relevant — never ' +
      'invent content to fill it. Never invent student names, attendance, statements, or ' +
      'conclusions that are not actually present in the transcript below; if speakers are not ' +
      'individually distinguishable, leave "participantInsights" empty rather than guessing. ' +
      'Keep transcript language as-is when quoting — do not translate.\n\n' +
      `Transcript:\n${input.transcriptText}`;

    const parsed = (await chatCompletionJson(
      this.apiKey,
      this.summaryModel,
      prompt,
    )) as Partial<SummaryResult>;

    return {
      executiveSummary: parsed.executiveSummary ?? '',
      keyLearningPoints: parsed.keyLearningPoints ?? [],
      importantQuestions: parsed.importantQuestions ?? [],
      actionItems: parsed.actionItems ?? [],
      trainerDiscussion: parsed.trainerDiscussion ?? '',
      studentParticipation: parsed.studentParticipation ?? '',
      importantObservations: parsed.importantObservations ?? [],
      followUpRequired: parsed.followUpRequired ?? [],
      participantInsights: parsed.participantInsights ?? [],
    };
  }
}
