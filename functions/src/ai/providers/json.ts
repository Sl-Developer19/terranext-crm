import type { SpeakerRole } from './types';

/** Shared by every provider that asks a model to respond as JSON — strips an
 * optional ```json fence before parsing, since models don't reliably honour
 * "no markdown" instructions. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse((candidate ?? text).trim());
}

export function toSpeakerRole(value: unknown): SpeakerRole {
  return value === 'trainer' || value === 'student' ? value : 'unknown';
}
