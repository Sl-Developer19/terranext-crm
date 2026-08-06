import type { RecordingSourceKind } from '../schema';

/**
 * Hardware abstraction for the recorder's input (AI Knowledge Capture Room
 * Hardware Requirements, "Future Ready" §9). Every concrete `AudioSource`
 * ultimately produces a standard `MediaStream` — that's what `MediaRecorder`
 * (and the rest of the chunk-recording pipeline in `session-recorder.tsx`)
 * consumes, and it never needs to know which implementation produced it.
 * Today there is exactly one implementation, `MediaDeviceAudioSource`
 * (browser `getUserMedia` against a single selected `audioinput` device —
 * covers the laptop mic, a USB audio interface, and a wireless receiver's
 * USB/analog output alike, since the browser sees all three as ordinary
 * input devices). A future multi-channel mixer or digital console
 * integration — Web Audio can already read multiple channels off one
 * device via `channelCount`, or a WebHID/WebUSB-backed source for hardware
 * that exposes control surfaces — would implement this same interface and
 * plug into the recorder with no change to chunking, pause/resume, upload,
 * or the OpenAI pipeline.
 */
export interface AudioSource {
  /** Opens the device and returns the live stream. Throws on permission
   * denial, an unavailable device, or any other `getUserMedia` failure. */
  start(): Promise<MediaStream>;
  /** Releases every acquired resource (tracks, AudioContext). Safe to call
   * multiple times or before `start()`. */
  stop(): void;
  /** The current stream, or `null` if not started / already stopped. */
  getStream(): MediaStream | null;
  /** Static capability/identity info — only fully populated once the
   * device has actually been opened once (see `AudioDeviceInfo`). */
  describe(): AudioDeviceInfo;
  /** Invoked ~10x/second with a live level reading while started. */
  onLevel(callback: (sample: AudioLevelSample) => void): void;
  /** Invoked once if the underlying hardware disconnects while started
   * (unplugged, powered off, OS reclaimed it). */
  onDisconnect(callback: () => void): void;
}

/**
 * What the browser can tell us about an input device. `sampleRate` and
 * `channelCount` are only knowable once the device has been opened at
 * least once in this page load — `navigator.mediaDevices.enumerateDevices()`
 * exposes device name/id but never capabilities, by design (reading audio
 * capabilities without permission would fingerprint hardware). They stay
 * `null` for every device the trainer hasn't selected/opened yet; that is
 * accurate, not a bug — the UI should say "select to check", never invent a
 * number.
 */
export interface AudioDeviceInfo {
  deviceId: string;
  groupId: string;
  label: string;
  /** Best-effort guess from the device label — see `classifyRecordingSource`. */
  kind: RecordingSourceKind;
  sampleRate: number | null;
  channelCount: number | null;
  /** `enumerateDevices()` only ever lists devices currently present, so
   * every entry in a fresh list is connected by definition — this tracks a
   * *previously listed* device that has since disappeared (unplugged). */
  connected: boolean;
}

export interface AudioLevelSample {
  /** Running (RMS-ish) level, 0–100. */
  level: number;
  /** Peak-hold level, 0–100 — decays slowly so a brief transient is visible. */
  peak: number;
  /** True when recent samples are hard against the ceiling — the input gain
   * is too hot and the recording will distort. */
  clipping: boolean;
}

export type AudioQualityStatus = 'ok' | 'low' | 'silent' | 'clipping' | 'disconnected';

export interface AudioQualityWarning {
  status: AudioQualityStatus;
  message: string | null;
}

export interface DeviceHealthCheck {
  connected: boolean;
  signalPresent: boolean;
  sampleRateSupported: boolean;
  ready: boolean;
  /** Human-readable reasons `ready` is false, in priority order — the first
   * one is what the UI should lead with. */
  issues: string[];
}
