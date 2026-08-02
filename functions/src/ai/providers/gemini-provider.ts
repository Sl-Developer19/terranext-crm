import type {
  SpeakerRole,
  SpeechProvider,
  SummaryProvider,
  SummaryResult,
  TranscriptionResult,
  TranscriptSegment,
} from './types';

/**
 * Google Gemini implementation, called directly over REST (`fetch`) rather
 * than a vendor SDK — one fewer dependency for a Functions workspace that
 * otherwise has none, and the surface used here (`generateContent`) is
 * small enough that a thin wrapper is clearer than a generic client.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse((candidate ?? text).trim());
}

async function generateContent(
  apiKey: string,
  modelId: string,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
): Promise<string> {
  const response = await fetch(
    `${API_BASE}/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini API returned no content.');
  return text;
}

function toSpeakerRole(value: unknown): SpeakerRole {
  return value === 'trainer' || value === 'student' ? value : 'unknown';
}

export class GeminiSpeechProvider implements SpeechProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
  ) {}

  async transcribe(input: {
    audioBuffer: Buffer;
    contentType: string;
    sessionTitle: string;
  }): Promise<TranscriptionResult> {
    const prompt =
      'Transcribe this classroom training session audio. Identify which speaker is the ' +
      'trainer (leading instruction) versus a student (asking/answering), labelling anyone ' +
      'you cannot confidently classify as "unknown". Respond with ONLY minified JSON of the ' +
      'shape {"language":"<ISO 639-1 code>","segments":[{"speaker":"trainer|student|unknown",' +
      '"speakerLabel":"<short display label>","text":"<verbatim>","startSec":<number>,' +
      '"endSec":<number>}]}. No markdown, no commentary.';

    const text = await generateContent(this.apiKey, this.modelId, [
      { text: prompt },
      { inlineData: { mimeType: input.contentType, data: input.audioBuffer.toString('base64') } },
    ]);

    const parsed = extractJson(text) as {
      language?: string;
      segments?: Array<{
        speaker?: string;
        speakerLabel?: string;
        text?: string;
        startSec?: number;
        endSec?: number;
      }>;
    };

    const segments: TranscriptSegment[] = (parsed.segments ?? []).map((s) => ({
      speaker: toSpeakerRole(s.speaker),
      speakerLabel: s.speakerLabel ?? 'Unknown speaker',
      text: s.text ?? '',
      startSec: typeof s.startSec === 'number' ? s.startSec : 0,
      endSec: typeof s.endSec === 'number' ? s.endSec : 0,
    }));

    return {
      fullText: segments.map((s) => s.text).join(' '),
      language: parsed.language ?? 'en',
      segments,
    };
  }
}

export class GeminiSummaryProvider implements SummaryProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly modelId: string,
  ) {}

  async summarize(input: { transcriptText: string; sessionTitle: string }): Promise<SummaryResult> {
    const prompt =
      `You are analysing the transcript of a training session titled "${input.sessionTitle}". ` +
      'Produce ONLY minified JSON of the shape {"executiveSummary":"<2-4 sentence summary>",' +
      '"keyLearningPoints":["..."],"importantQuestions":["..."],"actionItems":["..."]}. ' +
      'No markdown, no commentary.\n\nTranscript:\n' +
      input.transcriptText;

    const text = await generateContent(this.apiKey, this.modelId, [{ text: prompt }]);
    const parsed = extractJson(text) as Partial<SummaryResult>;

    return {
      executiveSummary: parsed.executiveSummary ?? '',
      keyLearningPoints: parsed.keyLearningPoints ?? [],
      importantQuestions: parsed.importantQuestions ?? [],
      actionItems: parsed.actionItems ?? [],
    };
  }
}
