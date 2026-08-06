import { RECORDING_SOURCES, type RecordingSourceKind } from '../schema';
import type { AudioQualityWarning, DeviceHealthCheck } from './types';

/**
 * Pure classroom-hardware logic — no `navigator`, no DOM, unit-testable
 * without jsdom. `media-device-audio-source.ts` and `session-recorder.tsx`
 * are the only callers that touch real browser APIs.
 */

export const RECORDING_SOURCE_LABELS: Record<RecordingSourceKind, string> = {
  laptop_microphone: 'Laptop microphone',
  usb_audio_interface: 'USB audio interface',
  wireless_receiver: 'Wireless receiver',
  professional_audio_mixer: 'Professional audio mixer',
};

/**
 * Best-effort guess at what kind of hardware a device is, from the label
 * string the browser reports (`MediaDeviceInfo.label`, e.g. "Focusrite
 * Scarlett 2i2 USB (0abc:1234)"). This is display-only labeling for the
 * device list — see the comment on `RECORDING_SOURCES` in `../schema.ts` —
 * never a filter on which devices the trainer can select. Labels are
 * matched case-insensitively; the strongest, least ambiguous keywords are
 * checked first, falling back to a vendor-name table built from this
 * module's supported hardware, and finally to `laptop_microphone` — the
 * safe default that matches every device's prior behavior before this
 * feature existed.
 */
export function classifyRecordingSource(label: string): RecordingSourceKind {
  const text = label.toLowerCase();
  if (!text) return 'laptop_microphone';

  const wirelessKeywords = [
    'wireless',
    'receiver',
    'lapel',
    'lavalier',
    'lark',
    'go mic',
    'wireless go',
    'blx',
    'mxw',
    'ew1',
    'ew-',
  ];
  if (wirelessKeywords.some((k) => text.includes(k))) return 'wireless_receiver';

  const mixerKeywords = ['mixer', 'console', 'xr18', 'xr16', 'x32', 'mg10', 'mg12', 'mg16', 'mgp'];
  if (mixerKeywords.some((k) => text.includes(k))) return 'professional_audio_mixer';

  const interfaceKeywords = [
    'interface',
    'scarlett',
    'audient',
    'presonus',
    'steinberg',
    'usb audio',
    'usb-audio',
  ];
  if (interfaceKeywords.some((k) => text.includes(k))) return 'usb_audio_interface';

  // Vendor fallback — the exact brands called out in the classroom hardware
  // spec, mapped to the product line each is best known for. A vendor name
  // alone is a weaker signal than the keywords above, which is why it's
  // checked last.
  const vendorDefaults: Array<[string, RecordingSourceKind]> = [
    ['focusrite', 'usb_audio_interface'],
    ['behringer', 'usb_audio_interface'],
    ['yamaha', 'professional_audio_mixer'],
    ['rode', 'wireless_receiver'],
    ['shure', 'wireless_receiver'],
    ['hollyland', 'wireless_receiver'],
    ['dji', 'wireless_receiver'],
    ['sennheiser', 'wireless_receiver'],
  ];
  for (const [vendor, kind] of vendorDefaults) {
    if (text.includes(vendor)) return kind;
  }

  const laptopKeywords = ['built-in', 'internal', 'default', 'laptop', 'macbook', 'realtek'];
  if (laptopKeywords.some((k) => text.includes(k))) return 'laptop_microphone';

  return 'laptop_microphone';
}

export function isRecordingSourceKind(value: string): value is RecordingSourceKind {
  return (RECORDING_SOURCES as readonly string[]).includes(value);
}

/**
 * Thresholds tuned for the 0–100 level scale `MediaDeviceAudioSource`
 * produces from a byte-domain `AnalyserNode` (0–255 raw, this module never
 * sees raw bytes). `peak` — not the smoothed running `level` — drives
 * clipping/silence: a loud transient the running average smooths away is
 * exactly what clips the actual recording, and a silent room still shows
 * brief non-zero `level` from float rounding/noise floor, but never a real
 * peak.
 */
const CLIPPING_PEAK_THRESHOLD = 97;
const SILENT_PEAK_THRESHOLD = 2;
const LOW_LEVEL_THRESHOLD = 12;

export function evaluateAudioQuality(input: {
  level: number;
  peak: number;
  connected: boolean;
}): AudioQualityWarning {
  if (!input.connected) {
    return { status: 'disconnected', message: 'The selected microphone is disconnected.' };
  }
  if (input.peak >= CLIPPING_PEAK_THRESHOLD) {
    return {
      status: 'clipping',
      message: 'Input is clipping — lower the microphone/receiver gain.',
    };
  }
  if (input.peak <= SILENT_PEAK_THRESHOLD) {
    return {
      status: 'silent',
      message: 'No audio signal detected — check the microphone is on and unmuted.',
    };
  }
  if (input.level < LOW_LEVEL_THRESHOLD) {
    return {
      status: 'low',
      message: 'Audio level is very low — move the microphone closer or raise its gain.',
    };
  }
  return { status: 'ok', message: null };
}

/** A sample rate this low is still technically decodable but unusually low
 * for speech transcription — most browsers report 44100/48000 by default. */
const MIN_SUPPORTED_SAMPLE_RATE_HZ = 8000;

export function evaluateDeviceHealth(input: {
  connected: boolean;
  signalPresent: boolean;
  sampleRate: number | null;
}): DeviceHealthCheck {
  const issues: string[] = [];

  if (!input.connected) issues.push('Device is not connected.');
  const sampleRateSupported =
    input.sampleRate === null || input.sampleRate >= MIN_SUPPORTED_SAMPLE_RATE_HZ;
  if (!sampleRateSupported) issues.push('Sample rate is unusually low for speech transcription.');
  if (input.connected && !input.signalPresent) {
    issues.push('No audio signal detected yet — speak or make noise near the microphone.');
  }

  const ready = input.connected && input.signalPresent && sampleRateSupported;

  return {
    connected: input.connected,
    signalPresent: input.signalPresent,
    sampleRateSupported,
    ready,
    issues,
  };
}
