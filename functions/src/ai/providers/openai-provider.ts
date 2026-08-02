import { extractJson, toSpeakerRole } from './json';
import type {
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
  audioBuffer: Buffer,
  contentType: string,
): Promise<{ text: string; language: string; segments: WhisperSegment[] }> {
  const form = new FormData();
  form.append('model', 'whisper-1');
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
    private readonly chatModel: string,
  ) {}

  async transcribe(input: {
    audioBuffer: Buffer;
    contentType: string;
    sessionTitle: string;
  }): Promise<TranscriptionResult> {
    const whisper = await transcribeWithWhisper(this.apiKey, input.audioBuffer, input.contentType);

    if (whisper.segments.length === 0) {
      return { fullText: whisper.text, language: whisper.language, segments: [] };
    }

    const classificationPrompt =
      'Classify each numbered transcript segment from a classroom training session as ' +
      '"trainer" (leading instruction) or "student" (asking/answering), or "unknown" if unclear. ' +
      'Respond with ONLY JSON {"speakers":[{"index":<number>,"speaker":"trainer|student|unknown",' +
      '"speakerLabel":"<short label>"}]}.\n\n' +
      whisper.segments.map((s, i) => `${i}: ${s.text}`).join('\n');

    const classification = (await chatCompletionJson(
      this.apiKey,
      this.chatModel,
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
      };
    });

    return { fullText: whisper.text, language: whisper.language, segments };
  }
}

export class OpenAISummaryProvider implements SummaryProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly chatModel: string,
  ) {}

  async summarize(input: { transcriptText: string; sessionTitle: string }): Promise<SummaryResult> {
    const prompt =
      `You are analysing the transcript of a training session titled "${input.sessionTitle}". ` +
      'Respond with ONLY JSON {"executiveSummary":"<2-4 sentence summary>",' +
      '"keyLearningPoints":["..."],"importantQuestions":["..."],"actionItems":["..."]}.\n\n' +
      `Transcript:\n${input.transcriptText}`;

    const parsed = (await chatCompletionJson(
      this.apiKey,
      this.chatModel,
      prompt,
    )) as Partial<SummaryResult>;

    return {
      executiveSummary: parsed.executiveSummary ?? '',
      keyLearningPoints: parsed.keyLearningPoints ?? [],
      importantQuestions: parsed.importantQuestions ?? [],
      actionItems: parsed.actionItems ?? [],
    };
  }
}
