import { defineSecret, defineString } from 'firebase-functions/params';

import { GeminiSpeechProvider, GeminiSummaryProvider } from './gemini-provider';
import { MockSpeechProvider, MockSummaryProvider } from './mock-provider';
import { OpenAISpeechProvider, OpenAISummaryProvider } from './openai-provider';
import type { SpeechProvider, SummaryProvider } from './types';

/**
 * Provider selection, entirely environment-driven (AI Session Intelligence
 * Proposal: "swappable using environment variables, never hardcoded to one
 * vendor"). `AI_SPEECH_PROVIDER` / `AI_SUMMARY_PROVIDER` pick the vendor;
 * each vendor needs its own API key secret. Missing the selected vendor's
 * key falls back to the mock provider rather than failing the deploy or the
 * pipeline — the module stays fully operable with the external call simply
 * disabled until credentials are supplied.
 */

export const AI_SPEECH_PROVIDER = defineString('AI_SPEECH_PROVIDER', { default: 'mock' });
export const AI_SUMMARY_PROVIDER = defineString('AI_SUMMARY_PROVIDER', { default: 'mock' });
export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
export const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-2.5-flash' });
const OPENAI_CHAT_MODEL = defineString('OPENAI_CHAT_MODEL', { default: 'gpt-4o-mini' });

export function getSpeechProvider(): SpeechProvider {
  const selected = AI_SPEECH_PROVIDER.value();

  if (selected === 'gemini') {
    const key = GEMINI_API_KEY.value();
    if (key) return new GeminiSpeechProvider(key, GEMINI_MODEL.value());
  }
  if (selected === 'openai') {
    const key = OPENAI_API_KEY.value();
    if (key) return new OpenAISpeechProvider(key, OPENAI_CHAT_MODEL.value());
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
    if (key) return new OpenAISummaryProvider(key, OPENAI_CHAT_MODEL.value());
  }
  return new MockSummaryProvider();
}
