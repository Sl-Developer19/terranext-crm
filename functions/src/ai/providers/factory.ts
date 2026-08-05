import { defineSecret, defineString } from 'firebase-functions/params';

import { GeminiSpeechProvider, GeminiSummaryProvider } from './gemini-provider';
import { MockSpeechProvider, MockSummaryProvider } from './mock-provider';
import { OpenAISpeechProvider, OpenAISummaryProvider } from './openai-provider';
import type { SpeechProvider, SummaryProvider } from './types';

/**
 * Provider selection, entirely environment-driven (AI Session Intelligence
 * Proposal: "swappable using environment variables, never hardcoded to one
 * vendor"). `AI_SPEECH_PROVIDER` / `AI_SUMMARY_PROVIDER` pick the vendor —
 * OpenAI is the default active vendor now that real credentials are
 * available; Mock remains the automatic, zero-config fallback whenever the
 * selected vendor's key secret isn't set, so the pipeline stays fully
 * exercisable (queue, stages, retry, dashboard) without a key in local dev
 * or CI.
 */

export const AI_SPEECH_PROVIDER = defineString('AI_SPEECH_PROVIDER', { default: 'openai' });
export const AI_SUMMARY_PROVIDER = defineString('AI_SUMMARY_PROVIDER', { default: 'openai' });
export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
export const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-2.5-flash' });

/**
 * whisper-1 stays the default transcription model deliberately, not one of
 * OpenAI's newer gpt-4o-transcribe/gpt-transcribe models: as of their
 * release, those support only `json`/`text` output and drop
 * `verbose_json`/`timestamp_granularities` entirely — no per-segment
 * timestamps. This pipeline's merge step
 * (`chunk-pipeline.ts#mergeChunkTranscripts`) depends on exactly that to
 * place each chunk's transcript on the session timeline; whisper-1 remains
 * the only OpenAI model that provides it. Override via
 * OPENAI_TRANSCRIBE_MODEL only once a newer model regains timestamp
 * support.
 */
const OPENAI_TRANSCRIBE_MODEL = defineString('OPENAI_TRANSCRIBE_MODEL', { default: 'whisper-1' });

/**
 * gpt-4o-mini for both the trainer/student classification pass (inside
 * OpenAISpeechProvider — Whisper itself doesn't diarize) and the executive
 * summary / key points / questions / action items pass. A well-established,
 * inexpensive chat-completions model with reliable JSON-mode output,
 * appropriate for high-volume structured extraction over a 45–90 minute
 * transcript. Override via OPENAI_SUMMARY_MODEL.
 */
const OPENAI_SUMMARY_MODEL = defineString('OPENAI_SUMMARY_MODEL', { default: 'gpt-4o-mini' });

export function getSpeechProvider(): SpeechProvider {
  const selected = AI_SPEECH_PROVIDER.value();

  if (selected === 'gemini') {
    const key = GEMINI_API_KEY.value();
    if (key) return new GeminiSpeechProvider(key, GEMINI_MODEL.value());
  }
  if (selected === 'openai') {
    const key = OPENAI_API_KEY.value();
    if (key) {
      return new OpenAISpeechProvider(
        key,
        OPENAI_TRANSCRIBE_MODEL.value(),
        OPENAI_SUMMARY_MODEL.value(),
      );
    }
  }
  return new MockSpeechProvider();
}

export function getSummaryProvider(): SummaryProvider {
  const selected = AI_SUMMARY_PROVIDER.value();

  if (selected === 'gemini') {
    const key = GEMINI_API_KEY.value();
    if (key) return new GeminiSummaryProvider(key, GEMINI_MODEL.value());
  }
  if (selected === 'openai') {
    const key = OPENAI_API_KEY.value();
    if (key) return new OpenAISummaryProvider(key, OPENAI_SUMMARY_MODEL.value());
  }
  return new MockSummaryProvider();
}
