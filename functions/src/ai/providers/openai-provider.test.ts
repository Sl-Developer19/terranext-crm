import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAISpeechProvider, OpenAISummaryProvider } from './openai-provider';

/**
 * Regression coverage for two easy-to-silently-break guarantees:
 *
 * 1. Language preservation (AI Session Intelligence requirement #8):
 *    transcription must call OpenAI's `/audio/transcriptions` endpoint
 *    (transcribes in the spoken language) — never `/translations` (which
 *    would force English output) — and must never send a `language` form
 *    field, which would suppress Whisper's own language auto-detection and
 *    could force Tamil speech to be mis-transcribed as English.
 * 2. The structured-summary schema (requirement #10/#11): every field,
 *    old and newly added, must come back with a safe default when the
 *    model's JSON response omits it — never `undefined` reaching a
 *    Firestore write.
 *
 * `fetch` is stubbed rather than hitting the real API — this is unit
 * coverage of the request/response contract, not an integration test.
 */

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenAISpeechProvider.transcribe — language preservation', () => {
  it('calls /audio/transcriptions, never /translations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          text: 'வணக்கம்',
          language: 'ta',
          segments: [{ start: 0, end: 2, text: 'வணக்கம்' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speakers: [{ index: 0, speaker: 'trainer', speakerLabel: 'Trainer' }],
                }),
              },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISpeechProvider('sk-test', 'whisper-1', 'gpt-4o-mini');
    await provider.transcribe({
      audioBuffer: Buffer.from('fake-audio'),
      contentType: 'audio/webm',
      sessionTitle: 'Tamil session',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [transcriptionUrl] = fetchMock.mock.calls[0]!;
    expect(transcriptionUrl).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(transcriptionUrl).not.toContain('/translations');
  });

  it('never sends a `language` form field — Whisper must auto-detect, not be forced to English', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ text: 'hello', language: 'en', segments: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISpeechProvider('sk-test', 'whisper-1', 'gpt-4o-mini');
    await provider.transcribe({
      audioBuffer: Buffer.from('fake-audio'),
      contentType: 'audio/webm',
      sessionTitle: 'English session',
    });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const form = requestInit.body as FormData;
    expect(form.has('language')).toBe(false);
    expect(form.has('prompt')).toBe(false);
    expect(form.get('model')).toBe('whisper-1');
  });

  it("preserves Whisper's own segment text verbatim — the classification pass only adds a speaker label, never rewrites content", async () => {
    const originalText = 'சரி, இப்போ கேள்வி கேளுங்க — mix ah Tamil and English pesalam.';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          text: originalText,
          language: 'ta',
          segments: [{ start: 0, end: 4, text: originalText }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speakers: [{ index: 0, speaker: 'student', speakerLabel: 'Student 1' }],
                }),
              },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISpeechProvider('sk-test', 'whisper-1', 'gpt-4o-mini');
    const result = await provider.transcribe({
      audioBuffer: Buffer.from('fake-audio'),
      contentType: 'audio/webm',
      sessionTitle: 'Tanglish session',
    });

    expect(result.language).toBe('ta');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.text).toBe(originalText);
    expect(result.segments[0]!.speaker).toBe('student');
    expect(result.segments[0]!.speakerLabel).toBe('Student 1');
  });

  it('skips the classification API call entirely when a real channel identity is already known — no guessing needed, and no wasted call', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        text: 'Sir, I have a doubt.',
        language: 'en',
        segments: [{ start: 0, end: 3, text: 'Sir, I have a doubt.' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISpeechProvider('sk-test', 'whisper-1', 'gpt-4o-mini');
    const result = await provider.transcribe({
      audioBuffer: Buffer.from('fake-audio'),
      contentType: 'audio/webm',
      sessionTitle: 'Channel-tagged session',
      knownSpeaker: { role: 'student', label: 'Student 1', channelIndex: 1 },
    });

    // Only the Whisper call — the classification chat-completion call never happens.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.segments).toEqual([
      {
        speaker: 'student',
        speakerLabel: 'Student 1',
        text: 'Sir, I have a doubt.',
        startSec: 0,
        endSec: 3,
        attributionSource: 'channel',
        channelIndex: 1,
      },
    ]);
  });

  it('every heuristic (no knownSpeaker) segment is stamped attributionSource "heuristic" with channelIndex null — never conflated with real channel identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          text: 'hello',
          language: 'en',
          segments: [{ start: 0, end: 1, text: 'hello' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  speakers: [{ index: 0, speaker: 'trainer', speakerLabel: 'Trainer' }],
                }),
              },
            },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISpeechProvider('sk-test', 'whisper-1', 'gpt-4o-mini');
    const result = await provider.transcribe({
      audioBuffer: Buffer.from('fake-audio'),
      contentType: 'audio/webm',
      sessionTitle: 'Mixed-stream session',
    });

    expect(result.segments[0]!.attributionSource).toBe('heuristic');
    expect(result.segments[0]!.channelIndex).toBeNull();
  });

  it('propagates a transcription API error with the status code, rather than silently returning empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: 'Incorrect API key provided' } }, 401),
      );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISpeechProvider('sk-bad', 'whisper-1', 'gpt-4o-mini');
    await expect(
      provider.transcribe({
        audioBuffer: Buffer.from('x'),
        contentType: 'audio/webm',
        sessionTitle: 'x',
      }),
    ).rejects.toThrow(/401/);
  });
});

describe('OpenAISummaryProvider.summarize — structured field defaults', () => {
  it('fills every new field with a safe empty default when the model omits them (older-shaped response)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                executiveSummary: 'A short session on X.',
                keyLearningPoints: ['Point A'],
                importantQuestions: [],
                actionItems: [],
                // trainerDiscussion / studentParticipation / importantObservations /
                // followUpRequired / participantInsights deliberately omitted.
              }),
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISummaryProvider('sk-test', 'gpt-4o-mini');
    const result = await provider.summarize({ transcriptText: 'transcript...', sessionTitle: 'X' });

    expect(result.executiveSummary).toBe('A short session on X.');
    expect(result.keyLearningPoints).toEqual(['Point A']);
    expect(result.trainerDiscussion).toBe('');
    expect(result.studentParticipation).toBe('');
    expect(result.importantObservations).toEqual([]);
    expect(result.followUpRequired).toEqual([]);
    expect(result.participantInsights).toEqual([]);
  });

  it('passes every new field through when the model does provide them', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                executiveSummary: 'Summary.',
                keyLearningPoints: [],
                importantQuestions: [],
                actionItems: [],
                trainerDiscussion: 'Trainer covered topic A and B.',
                studentParticipation: 'Two students asked clarifying questions.',
                importantObservations: ['One student seemed confused about B.'],
                followUpRequired: ['Revisit topic B next session.'],
                participantInsights: [],
              }),
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISummaryProvider('sk-test', 'gpt-4o-mini');
    const result = await provider.summarize({ transcriptText: 'transcript...', sessionTitle: 'X' });

    expect(result.trainerDiscussion).toBe('Trainer covered topic A and B.');
    expect(result.studentParticipation).toBe('Two students asked clarifying questions.');
    expect(result.importantObservations).toEqual(['One student seemed confused about B.']);
    expect(result.followUpRequired).toEqual(['Revisit topic B next session.']);
    expect(result.participantInsights).toEqual([]);
  });

  it('the prompt explicitly instructs the model not to translate and not to invent student identities', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: JSON.stringify({ executiveSummary: '' }) } }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenAISummaryProvider('sk-test', 'gpt-4o-mini');
    await provider.summarize({ transcriptText: 'transcript...', sessionTitle: 'X' });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(requestInit.body as string) as { messages: Array<{ content: string }> };
    const prompt = body.messages[0]!.content;
    expect(prompt).toMatch(/do not translate/i);
    expect(prompt).toMatch(/never invent/i);
  });
});
