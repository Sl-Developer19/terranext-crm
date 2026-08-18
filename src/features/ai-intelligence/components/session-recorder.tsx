'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Mic,
  Pause,
  Play,
  Square,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

import {
  confirmChunkUpload,
  finalizeSessionRecording,
  pauseSessionRecording,
  requestChunkUploadTicket,
  resumeSessionRecording,
  startSessionRecording,
} from '../actions/record-audio';
import {
  evaluateAudioQuality,
  evaluateDeviceHealth,
  RECORDING_SOURCE_LABELS,
} from '../audio/device-classification';
import { listAudioInputDevices, MediaDeviceAudioSource } from '../audio/media-device-audio-source';
import type {
  AudioDeviceInfo,
  AudioLevelSample,
  AudioQualityWarning,
  DeviceHealthCheck,
} from '../audio/types';
import { deriveRecorderViewMode, formatDuration } from '../logic';
import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  CHUNK_DURATION_SECONDS,
  MAX_CHUNKS_PER_SESSION,
  MAX_MAPPED_CHANNELS,
  MAX_SESSION_DURATION_SECONDS,
  type AiSession,
  type AllowedAudioContentType,
  type ChannelRoleMapping,
  type RecordingSourceKind,
} from '../schema';

type RecorderStatus = 'idle' | 'recording' | 'paused' | 'uploading' | 'error';
type StopReason = 'rollover' | 'final';
type MonitorStatus = 'idle' | 'starting' | 'active' | 'error';

/** One physical input channel's independent capture lane — see
 * `channelLanesRef`'s doc comment on the component for when this is used
 * instead of the single `recorderRef`/`chunkBufferRef` pair. */
interface ChannelLane {
  channelIndex: number;
  stream: MediaStream;
  recorder: MediaRecorder | null;
  chunkBuffer: Blob[];
}

/** Last device the trainer picked, remembered across sessions/page loads on
 * this browser — classroom hardware is normally plugged in once and left
 * alone, so re-selecting it every session would be pure friction. */
const LAST_DEVICE_STORAGE_KEY = 'ai-intelligence:last-audio-device-id';

const MEDIA_RECORDER_TIMESLICE_MS = 1000;
const CHUNK_UPLOAD_MAX_ATTEMPTS = 3;
const CHUNK_UPLOAD_RETRY_DELAY_MS = 1000;

/** Diagnostic trail for the ticket → PUT → confirm cycle — deliberately never
 * includes the signed URL itself, request/response headers, or audio bytes,
 * only the metadata needed to pinpoint which step of which chunk's upload
 * failed (see Engineering 04 debugging checklist). */
function logChunkUploadEvent(event: string, context: Record<string, unknown>) {
  console.warn(`[ai-intelligence:chunk-upload] ${event}`, context);
}
function logChunkUploadError(event: string, error: unknown, context: Record<string, unknown>) {
  console.error(`[ai-intelligence:chunk-upload] ${event}`, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  });
}

/** The four physical microphones the hardware mapping test walks through —
 * purely a UI aid for the trainer/admin running "Check microphone" against
 * real classroom hardware; nothing here is persisted. The real, saved
 * mapping lives in AI Intelligence Settings (`channelRoleMap`) once the
 * trainer reports back which channel number reacted to which mic. */
type MicRole = 'trainer' | 'student1' | 'student2' | 'student3';
const MIC_ROLES: MicRole[] = ['trainer', 'student1', 'student2', 'student3'];
const MIC_ROLE_LABELS: Record<MicRole, string> = {
  trainer: 'Trainer earset',
  student1: 'Student handheld 1',
  student2: 'Student handheld 2',
  student3: 'Student handheld 3',
};
type ChannelTestResults = Record<MicRole, { tested: boolean; channel: number | null }>;
const EMPTY_CHANNEL_TEST_RESULTS: ChannelTestResults = {
  trainer: { tested: false, channel: null },
  student1: { tested: false, channel: null },
  student2: { tested: false, channel: null },
  student3: { tested: false, channel: null },
};

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

function normalizeContentType(mimeType: string): AllowedAudioContentType {
  const base = mimeType.split(';')[0]?.trim() ?? 'audio/webm';
  return (ALLOWED_AUDIO_CONTENT_TYPES as readonly string[]).includes(base)
    ? (base as AllowedAudioContentType)
    : 'audio/webm';
}

/**
 * The recording screen (AI Knowledge Capture Room Hardware Requirements),
 * now supporting the full 45–90 minute classroom range: internally, the
 * recorder rolls over to a brand-new `MediaRecorder` on the same
 * microphone stream every `CHUNK_DURATION_SECONDS` (~10 minutes of *active*
 * recording — see Pause/Resume below), uploading each finished chunk in the
 * background while the next one is already being captured. None of that is
 * visible — device selector, live level meter, timer, and Start/Stop are
 * the core interface, exactly as before, plus Pause/Resume (see below).
 *
 * The rollover technique (stop one MediaRecorder, immediately start a new
 * one on the same stream) is what makes each chunk an independently valid,
 * decodable audio file — concatenated `ondataavailable` blobs from a single
 * continuous recorder are not independently valid without the others. The
 * unavoidable cost is a sub-100ms gap in the recording at each rollover
 * boundary, the standard tradeoff of this approach and far preferable to
 * ever holding 90 minutes of audio in memory at once client- or server-side.
 *
 * Pause/Resume deliberately uses the browser's native
 * `MediaRecorder.pause()`/`.resume()` on the *current* chunk's recorder,
 * rather than finalizing a chunk on every pause: a trainer may pause many
 * times in one session (phone call, tea break, private conversation), and
 * treating every pause as a chunk boundary would risk exceeding
 * `MAX_CHUNKS_PER_SESSION` on a session with several short pauses. Native
 * pause/resume instead produces zero extra chunks, zero extra uploads, and
 * — because the browser excludes paused time from the encoded output
 * entirely — guarantees paused audio can never reach transcription,
 * summarization, or analytics without any change to the processing
 * pipeline at all. The rollover and max-duration timers are themselves
 * paused and resumed alongside the recorder, so the 10-minute chunk
 * boundary and the 90-minute session cap both measure *active* recording
 * time, never wall-clock time.
 */
export function SessionRecorder({
  session,
  defaultRecordingSource,
  channelRoleMap = [],
}: {
  session: AiSession;
  /** Classroom Hardware Mode default from Settings — a hint for which
   * connected device to pre-select, never a restriction on which the
   * trainer can choose (see the comment on `RECORDING_SOURCES` in
   * `../schema.ts`). */
  defaultRecordingSource?: RecordingSourceKind;
  /** Settings' configured channel→speaker mapping. An empty array (the
   * default until an admin configures one) keeps recording on exactly
   * today's single-mixed-track behavior — see the "Leave empty to keep
   * every session on today's single-mixed-track behavior" note in
   * `components/settings-form.tsx`. A non-empty mapping is what actually
   * switches `handleStart` into requesting a multi-channel stream. */
  channelRoleMap?: ChannelRoleMapping[];
}) {
  const router = useRouter();
  const [devices, setDevices] = React.useState<AudioDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState('');
  const [status, setStatus] = React.useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [peak, setPeak] = React.useState(0);
  const [clipping, setClipping] = React.useState(false);
  const [qualityWarning, setQualityWarning] = React.useState<AudioQualityWarning | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [currentPauseSeconds, setCurrentPauseSeconds] = React.useState(0);
  const [pausedTotalSeconds, setPausedTotalSeconds] = React.useState(0);
  const [pauseCount, setPauseCount] = React.useState(0);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  // Pre-recording device check ("Section 3/4: Live Audio Monitoring, Device
  // Health") — entirely separate from the recording-time capture above: it
  // opens its own short-lived MediaDeviceAudioSource purely to show the
  // trainer live level/peak/health/capabilities before they commit to
  // Start, and is always torn down before the real recording stream opens.
  const [monitorStatus, setMonitorStatus] = React.useState<MonitorStatus>('idle');
  const [monitorLevel, setMonitorLevel] = React.useState(0);
  const [monitorPeak, setMonitorPeak] = React.useState(0);
  /** One entry per physical input channel — only ever populated when the
   * opened device negotiates more than one channel, which today's default
   * `getUserMedia` constraints make rare even on real multi-channel
   * hardware; see `MediaDeviceAudioSource`'s class doc comment. */
  const [monitorPerChannel, setMonitorPerChannel] = React.useState<AudioLevelSample[] | null>(null);
  const [monitorHealth, setMonitorHealth] = React.useState<DeviceHealthCheck | null>(null);
  const [monitorQuality, setMonitorQuality] = React.useState<AudioQualityWarning | null>(null);
  const [monitorDeviceInfo, setMonitorDeviceInfo] = React.useState<AudioDeviceInfo | null>(null);
  const [monitorError, setMonitorError] = React.useState<string | null>(null);
  const monitorSourceRef = React.useRef<MediaDeviceAudioSource | null>(null);
  /** Hardware mapping test — see `MicRole` doc comment above. Reset every
   * time a fresh check starts so a previous device's readings never bleed
   * into the next one. */
  const [channelTestResults, setChannelTestResults] = React.useState<ChannelTestResults>(
    EMPTY_CHANNEL_TEST_RESULTS,
  );

  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunkBufferRef = React.useRef<Blob[]>([]);
  /** Channel-preserving capture — `null` whenever this recording is on the
   * single-mixed-track path (every session today, and every session on any
   * device where the browser doesn't actually negotiate >1 channel even if
   * Settings has a mapping configured). When populated, `recorderRef`/
   * `chunkBufferRef` above are unused; each lane owns its own `MediaRecorder`
   * on its own single-channel synthetic stream instead. */
  const channelLanesRef = React.useRef<ChannelLane[] | null>(null);
  /** How many lanes' `onstop` this rollover/stop boundary is still waiting
   * on before it's safe to advance to the next chunk or finalize — mirrors
   * the single-recorder path's implicit "there's only one, so its onstop is
   * the whole boundary" behavior. */
  const pendingLaneStopsRef = React.useRef(0);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const meterIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTickIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const rolloverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = React.useRef(0);
  const chunkIndexRef = React.useRef(0);
  const chunkStartOffsetRef = React.useRef(0);
  const stopReasonRef = React.useRef<StopReason>('rollover');
  const uploadPromisesRef = React.useRef<Array<Promise<boolean>>>([]);
  const preferredMimeTypeRef = React.useRef<string | undefined>(undefined);
  const actionPendingRef = React.useRef(false);

  // Pause/resume timing: the rollover and max-duration timers are wall-clock
  // `setTimeout`s, so pausing has to snapshot how much time was left on each
  // and resuming has to re-arm them for exactly that remaining span —
  // otherwise a long tea break would either fire a rollover mid-break or
  // shorten every later chunk.
  const rolloverDeadlineRef = React.useRef(0);
  const rolloverRemainingMsRef = React.useRef(0);
  const rolloverPendingRef = React.useRef(false);
  const maxDurationDeadlineRef = React.useRef(0);
  const maxDurationRemainingMsRef = React.useRef(0);
  const pauseStartedAtRef = React.useRef<number | null>(null);

  /** Device list + default selection: keeps the trainer's current pick if
   * it's still connected; otherwise prefers (in order) the last device
   * remembered on this browser, a connected device matching the org's
   * Classroom Hardware Mode default (Settings §6), then simply the first
   * device the browser reports. */
  const refreshDevices = React.useCallback(async () => {
    try {
      const inputs = await listAudioInputDevices();
      setDevices(inputs);
      setDeviceId((current) => {
        if (current && inputs.some((d) => d.deviceId === current)) return current;
        const remembered =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(LAST_DEVICE_STORAGE_KEY)
            : null;
        if (remembered && inputs.some((d) => d.deviceId === remembered)) return remembered;
        const preferred = defaultRecordingSource
          ? inputs.find((d) => d.kind === defaultRecordingSource)
          : undefined;
        return preferred?.deviceId || inputs[0]?.deviceId || '';
      });
    } catch {
      // Labels/ids are unavailable before permission is granted in some
      // browsers — Start still works via the browser's own device prompt.
    }
  }, [defaultRecordingSource]);

  /** Stops every timer this component owns — split out from
   * `releaseCaptureResources` (below) so `handleStopClick` can silence the
   * rollover/max-duration/meter/pause-tick timers immediately without also
   * killing the microphone track before the in-flight `MediaRecorder.stop()`
   * has actually finished flushing its final `dataavailable` event (see the
   * comment on `handleChunkRecorderStop`'s hardware teardown for why that
   * ordering matters). */
  const stopCaptureTimers = React.useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
    if (pauseTickIntervalRef.current) clearInterval(pauseTickIntervalRef.current);
    if (rolloverTimeoutRef.current) clearTimeout(rolloverTimeoutRef.current);
    if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    timerIntervalRef.current = null;
    meterIntervalRef.current = null;
    pauseTickIntervalRef.current = null;
    rolloverTimeoutRef.current = null;
    maxDurationTimeoutRef.current = null;
  }, []);

  /** Stops every acquired hardware resource (mic track + AudioContext) —
   * the mic light must go off whenever the recorder is not actively
   * recording, including when setup fails partway through (e.g.
   * getUserMedia succeeds but the AudioContext or MediaRecorder
   * construction throws). Includes `stopCaptureTimers` for every caller
   * except `handleStopClick`, which needs the timers silenced immediately
   * but the hardware kept alive a moment longer — see there. */
  const releaseCaptureResources = React.useCallback(() => {
    stopCaptureTimers();
    mediaStreamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    mediaStreamRef.current = null;
    // Synthetic per-channel streams hold no hardware of their own (they're
    // fed by the AudioContext graph off the one real device track stopped
    // above), but their tracks are still explicitly stopped and the lane
    // list cleared so a later Start never finds stale lanes from a previous
    // recording.
    channelLanesRef.current?.forEach((lane) => {
      lane.recorder = null;
      lane.stream.getTracks().forEach((t) => t.stop());
    });
    channelLanesRef.current = null;
    pendingLaneStopsRef.current = 0;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    setLevel(0);
    setPeak(0);
    setClipping(false);
    setQualityWarning(null);
  }, [stopCaptureTimers]);

  const stopMonitoring = React.useCallback(() => {
    monitorSourceRef.current?.stop();
    monitorSourceRef.current = null;
    setMonitorStatus('idle');
    setMonitorLevel(0);
    setMonitorPeak(0);
    setMonitorPerChannel(null);
    setMonitorHealth(null);
    setMonitorQuality(null);
    setMonitorDeviceInfo(null);
    setChannelTestResults(EMPTY_CHANNEL_TEST_RESULTS);
  }, []);

  /** "Check microphone" — opens the selected device just to monitor it
   * (level, peak, health, capabilities), completely separate from the
   * recording-time stream in `handleStart`. Always stopped before a real
   * recording starts (see `handleStart`) so at most one stream is ever open
   * on the device at a time. */
  const startMonitoring = React.useCallback(async () => {
    if (status !== 'idle' || monitorStatus === 'starting' || monitorStatus === 'active') return;
    setMonitorError(null);
    setMonitorStatus('starting');
    const selected = devices.find((d) => d.deviceId === deviceId);
    const source = new MediaDeviceAudioSource(deviceId, selected?.label ?? '');
    monitorSourceRef.current = source;
    source.onDisconnect(() => {
      setMonitorError('The microphone disconnected.');
      setMonitorStatus('idle');
      setMonitorHealth(null);
      monitorSourceRef.current = null;
      void refreshDevices();
    });
    source.onLevel((sample) => {
      setMonitorLevel(sample.level);
      setMonitorPeak(sample.peak);
      setMonitorPerChannel(sample.perChannel ?? null);
      const info = source.describe();
      setMonitorDeviceInfo(info);
      setMonitorHealth(
        evaluateDeviceHealth({
          connected: info.connected,
          signalPresent: sample.peak > 1,
          sampleRate: info.sampleRate,
        }),
      );
      setMonitorQuality(
        evaluateAudioQuality({
          level: sample.level,
          peak: sample.peak,
          connected: info.connected,
        }),
      );
    });

    try {
      await source.start();
      // The trainer may have clicked "Stop check" (or switched devices,
      // which also stops monitoring) while the browser's permission prompt
      // was still pending — in that case monitorSourceRef has already moved
      // on, and this now-stale source must be torn down, not activated.
      if (monitorSourceRef.current !== source) {
        source.stop();
        return;
      }
      setMonitorStatus('active');
      setMonitorDeviceInfo(source.describe());
    } catch (error) {
      source.stop();
      if (monitorSourceRef.current === source) monitorSourceRef.current = null;
      setMonitorStatus('error');
      setMonitorError(
        error instanceof Error ? error.message : 'Could not access the selected microphone.',
      );
    }
  }, [status, monitorStatus, devices, deviceId, refreshDevices]);

  // Switching devices mid-check invalidates whatever was being monitored —
  // simplest correct behaviour is to stop and let the trainer re-check the
  // newly selected device. `stopMonitoring` is stable (no deps) so this
  // effect only actually re-runs when `deviceId` changes.
  React.useEffect(() => {
    stopMonitoring();
  }, [deviceId, stopMonitoring]);

  // Remembers the trainer's selection for next time, on this browser.
  React.useEffect(() => {
    if (deviceId && typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_DEVICE_STORAGE_KEY, deviceId);
    }
  }, [deviceId]);

  React.useEffect(() => {
    void refreshDevices();
    // Auto-reconnect: a receiver/interface unplugged and replugged (or a
    // laptop mic that macOS/Windows briefly drops) reappears in this event
    // without the trainer having to do anything — refreshDevices() re-picks
    // it automatically if it matches the currently selected deviceId, or
    // falls back through the same preference order used on mount.
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
      releaseCaptureResources();
      stopMonitoring();
    };
  }, [refreshDevices, releaseCaptureResources, stopMonitoring]);

  /** Live monitoring during actual recording (Section 3) — reuses the same
   * analyser the recorder already creates in `handleStart`, just reading
   * two views of it: frequency-domain for the running level (as before),
   * time-domain for peak/clipping (the same technique
   * `MediaDeviceAudioSource` uses for the pre-recording check). Purely a
   * read of the existing analyser node; touches nothing about the
   * MediaRecorder/chunk/upload pipeline. */
  function startMeterLoop() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);
    let peakHold = 0;
    meterIntervalRef.current = setInterval(() => {
      analyser.getByteFrequencyData(freqData);
      let freqSum = 0;
      for (let i = 0; i < freqData.length; i++) freqSum += freqData[i] ?? 0;
      const currentLevel = Math.min(100, Math.round((freqSum / freqData.length / 255) * 100));
      setLevel(currentLevel);

      analyser.getByteTimeDomainData(timeData);
      let maxDeviation = 0;
      for (let i = 0; i < timeData.length; i++) {
        const deviation = Math.abs((timeData[i] ?? 128) - 128);
        if (deviation > maxDeviation) maxDeviation = deviation;
      }
      const instantPeak = Math.min(100, Math.round((maxDeviation / 128) * 100));
      peakHold = instantPeak > peakHold ? instantPeak : Math.max(0, peakHold - 3);
      setPeak(peakHold);
      setClipping(maxDeviation >= 126);
      setQualityWarning(
        evaluateAudioQuality({ level: currentLevel, peak: peakHold, connected: true }),
      );
    }, 100);
  }

  /** Arms (or, on the last allowed chunk, deliberately skips) the rollover
   * timer for whichever chunk is currently recording. */
  function armRolloverForCurrentChunk(remainingMs: number) {
    const isLastAllowedChunk = chunkIndexRef.current >= MAX_CHUNKS_PER_SESSION - 1;
    if (isLastAllowedChunk) {
      rolloverPendingRef.current = false;
      return;
    }
    rolloverPendingRef.current = true;
    rolloverDeadlineRef.current = Date.now() + remainingMs;
    rolloverTimeoutRef.current = setTimeout(rolloverToNextChunk, remainingMs);
  }

  function armMaxDurationStop(remainingMs: number) {
    maxDurationDeadlineRef.current = Date.now() + remainingMs;
    maxDurationTimeoutRef.current = setTimeout(
      () => {
        toast.warning(
          `Maximum recording length (${MAX_SESSION_DURATION_SECONDS / 60} minutes) reached — stopping automatically.`,
        );
        handleStopClick();
      },
      Math.max(0, remainingMs),
    );
  }

  /** Ticket → PUT → confirm for one chunk, with bounded retry — a classroom
   * Wi-Fi hiccup on one ~10-minute segment must not force the trainer to
   * notice, intervene, or lose the rest of a 90-minute session. */
  async function uploadChunkWithRetry(
    chunkIndex: number,
    channelIndex: number | null,
    blob: Blob,
    startOffsetSec: number,
    durationSeconds: number,
  ): Promise<boolean> {
    const contentType = normalizeContentType(blob.type);
    const sessionId = session.id;
    const logCtx = { sessionId, chunkIndex, channelIndex, sizeBytes: blob.size, contentType };

    for (let attempt = 1; attempt <= CHUNK_UPLOAD_MAX_ATTEMPTS; attempt++) {
      try {
        const ticket = await requestChunkUploadTicket({
          sessionId,
          chunkIndex,
          channelIndex,
          contentType,
          sizeBytes: blob.size,
          startOffsetSec,
        });
        if (!ticket.ok) {
          logChunkUploadEvent('ticket request rejected', {
            ...logCtx,
            attempt,
            code: ticket.error.code,
            message: ticket.error.message,
          });
          throw new Error(ticket.error.message);
        }
        logChunkUploadEvent('ticket issued', { ...logCtx, attempt });

        const response = await fetch(ticket.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': ticket.data.contentType },
          body: blob,
        });
        logChunkUploadEvent('PUT completed', {
          ...logCtx,
          attempt,
          httpStatus: response.status,
          ok: response.ok,
        });
        if (!response.ok) throw new Error(`Chunk upload failed (HTTP ${response.status})`);

        const confirmed = await confirmChunkUpload({
          sessionId,
          chunkIndex,
          channelIndex,
          durationSeconds,
        });
        if (!confirmed.ok) {
          logChunkUploadEvent('confirm request rejected', {
            ...logCtx,
            attempt,
            code: confirmed.error.code,
            message: confirmed.error.message,
          });
          throw new Error(confirmed.error.message);
        }
        logChunkUploadEvent('confirm result', {
          ...logCtx,
          attempt,
          status: confirmed.data.status,
        });
        if (confirmed.data.status === 'failed') throw new Error('Chunk failed verification');

        return true;
      } catch (error) {
        logChunkUploadError('attempt failed', error, { ...logCtx, attempt });
        if (attempt === CHUNK_UPLOAD_MAX_ATTEMPTS) {
          toast.error(
            channelIndex === null
              ? `Recording segment ${chunkIndex + 1} couldn't be saved after several attempts — check your connection.`
              : `Recording segment ${chunkIndex + 1} (channel ${channelIndex}) couldn't be saved after several attempts — check your connection.`,
          );
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, CHUNK_UPLOAD_RETRY_DELAY_MS * attempt));
      }
    }
    return false;
  }

  /** Legacy single-mixed-track path — untouched from before channel-
   * preserving capture existed. Used whenever `channelLanesRef.current` is
   * `null` (every session today). */
  function startSingleStreamRecorder() {
    const stream = mediaStreamRef.current;
    if (!stream) return;

    chunkBufferRef.current = [];
    const recorder = new MediaRecorder(
      stream,
      preferredMimeTypeRef.current ? { mimeType: preferredMimeTypeRef.current } : undefined,
    );
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunkBufferRef.current.push(event.data);
    };
    recorder.onstop = () => {
      handleChunkRecorderStop(recorder.mimeType || preferredMimeTypeRef.current || 'audio/webm');
    };
    // Without this, a genuine MediaRecorder failure (e.g. an encoder error)
    // fires no `stop` event on some browsers, so `handleChunkRecorderStop`
    // never runs and the UI is left stuck on "Saving…" with nothing in the
    // console explaining why — logged here so that failure mode is at least
    // diagnosable rather than silent.
    recorder.onerror = (event) => {
      console.error('[ai-intelligence:chunk-upload] MediaRecorder error', {
        sessionId: session.id,
        chunkIndex: chunkIndexRef.current,
        error:
          event.error instanceof DOMException
            ? event.error.message
            : event.message || 'unknown MediaRecorder error',
      });
    };
    recorder.start(MEDIA_RECORDER_TIMESLICE_MS);
    recorderRef.current = recorder;
  }

  /** Channel-preserving path — one `MediaRecorder` per physical channel's
   * synthetic mono stream (see `handleStart`'s Web Audio splitter setup).
   * Runs only when `channelLanesRef.current` is populated. */
  function startChannelLaneRecorders(lanes: ChannelLane[]) {
    for (const lane of lanes) {
      lane.chunkBuffer = [];
      const recorder = new MediaRecorder(
        lane.stream,
        preferredMimeTypeRef.current ? { mimeType: preferredMimeTypeRef.current } : undefined,
      );
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) lane.chunkBuffer.push(event.data);
      };
      recorder.onstop = () => {
        handleLaneRecorderStop(
          lane,
          recorder.mimeType || preferredMimeTypeRef.current || 'audio/webm',
        );
      };
      recorder.onerror = (event) => {
        console.error('[ai-intelligence:chunk-upload] MediaRecorder error', {
          sessionId: session.id,
          chunkIndex: chunkIndexRef.current,
          channelIndex: lane.channelIndex,
          error:
            event.error instanceof DOMException
              ? event.error.message
              : event.message || 'unknown MediaRecorder error',
        });
      };
      recorder.start(MEDIA_RECORDER_TIMESLICE_MS);
      lane.recorder = recorder;
    }
  }

  function startNextChunkRecorder() {
    const lanes = channelLanesRef.current;
    if (lanes) {
      startChannelLaneRecorders(lanes);
    } else {
      startSingleStreamRecorder();
    }

    // The last allowed chunk gets no rollover of its own — only the
    // max-duration auto-stop (or the trainer) may end it. Without this, a
    // 90-minute session landing exactly on a chunk boundary could schedule
    // a rollover and the auto-stop in the same instant, producing a 10th
    // chunk one over the business-ceiling-derived limit.
    armRolloverForCurrentChunk(CHUNK_DURATION_SECONDS * 1000);
  }

  /** Same "only while actually `recording`" guard the legacy single-recorder
   * path always used — a rollover timer firing in the narrow race window
   * around a pause must never fire a stop, since that would (via
   * `stopReasonRef.current === 'rollover'`) start a fresh chunk while the
   * session is paused. Arms `pendingLaneStopsRef` for the lane path so
   * `handleLaneRecorderStop` knows how many `onstop` calls this boundary is
   * waiting on. */
  function rolloverToNextChunk() {
    const lanes = channelLanesRef.current;
    if (lanes) {
      const recording = lanes.filter((lane) => lane.recorder?.state === 'recording');
      if (recording.length === 0) return;
      stopReasonRef.current = 'rollover';
      pendingLaneStopsRef.current = recording.length;
      for (const lane of recording) lane.recorder!.stop();
      return;
    }
    if (recorderRef.current?.state !== 'recording') return;
    stopReasonRef.current = 'rollover';
    recorderRef.current.stop();
  }

  function handleChunkRecorderStop(rawMimeType: string) {
    const finishedChunkIndex = chunkIndexRef.current;
    const finishedStartOffsetSec = chunkStartOffsetRef.current;
    const finishedDurationSeconds = Math.max(1, elapsedRef.current - finishedStartOffsetSec);
    const contentType = normalizeContentType(rawMimeType);
    const blob = new Blob(chunkBufferRef.current, { type: contentType });

    uploadPromisesRef.current.push(
      uploadChunkWithRetry(
        finishedChunkIndex,
        null,
        blob,
        finishedStartOffsetSec,
        finishedDurationSeconds,
      ),
    );

    if (stopReasonRef.current === 'rollover') {
      chunkIndexRef.current += 1;
      chunkStartOffsetRef.current = elapsedRef.current;
      startNextChunkRecorder();
    } else {
      // This is the *final* stop (trainer clicked Stop, max-duration
      // auto-stop, or the mic disconnected). The mic track and AudioContext
      // are deliberately kept alive until now rather than torn down the
      // instant `handleStopClick` called `recorder.stop()`: MediaRecorder's
      // stop algorithm still needs to flush its last buffered audio into a
      // final `dataavailable` event before this `onstop` handler runs, and
      // killing the underlying MediaStreamTrack first can cut that flush
      // short on some browsers/hardware — silently truncating or corrupting
      // exactly the chunk this function is about to upload. Now that we're
      // inside `onstop`, that flush has already happened (`ondataavailable`
      // fires before `onstop` per spec), so it's safe to release the
      // hardware. `handleStopClick` already stopped the timers immediately.
      releaseCaptureResources();
      void finalizeAfterStop(finishedChunkIndex + 1, 1);
    }
  }

  /** Channel-lane counterpart to `handleChunkRecorderStop` above — same
   * upload-then-advance-or-finalize logic, except a rollover/stop boundary
   * has `channelLanesRef.current!.length` independent `onstop` events
   * firing (one per physical channel), not one. `pendingLaneStopsRef` is
   * what makes this wait for every lane to flush before doing anything
   * that must only happen once per boundary — starting the next chunk's
   * recorders, or finalizing. */
  function handleLaneRecorderStop(lane: ChannelLane, rawMimeType: string) {
    const finishedChunkIndex = chunkIndexRef.current;
    const finishedStartOffsetSec = chunkStartOffsetRef.current;
    const finishedDurationSeconds = Math.max(1, elapsedRef.current - finishedStartOffsetSec);
    const contentType = normalizeContentType(rawMimeType);
    const blob = new Blob(lane.chunkBuffer, { type: contentType });

    uploadPromisesRef.current.push(
      uploadChunkWithRetry(
        finishedChunkIndex,
        lane.channelIndex,
        blob,
        finishedStartOffsetSec,
        finishedDurationSeconds,
      ),
    );

    // Captured before `releaseCaptureResources()` below, which clears
    // `channelLanesRef.current` — the lane count must be known to
    // `finalizeAfterStop` as a plain value, not re-read from a ref that's
    // about to become `null`.
    const capturedChannelCount = channelLanesRef.current?.length ?? 1;

    pendingLaneStopsRef.current -= 1;
    if (pendingLaneStopsRef.current > 0) return;

    if (stopReasonRef.current === 'rollover') {
      chunkIndexRef.current += 1;
      chunkStartOffsetRef.current = elapsedRef.current;
      startNextChunkRecorder();
    } else {
      releaseCaptureResources();
      void finalizeAfterStop(finishedChunkIndex + 1, capturedChannelCount);
    }
  }

  async function finalizeAfterStop(totalChunks: number, capturedChannelCount: number) {
    const totalDurationSeconds = elapsedRef.current;
    const results = await Promise.all(uploadPromisesRef.current);

    if (results.some((succeeded) => !succeeded)) {
      setStatus('error');
      setErrorMessage(
        'One or more recording segments could not be saved. Please contact support before deleting this session — do not record it again from scratch.',
      );
      return;
    }

    const outcome = await finalizeSessionRecording({
      sessionId: session.id,
      totalChunks,
      totalDurationSeconds,
      capturedChannelCount,
    });
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      setStatus('error');
      return;
    }

    toast.success('Recording saved — transcription and AI analysis started automatically.');
    router.refresh();
  }

  async function handleStart() {
    // Guards a double-click the same way handlePauseClick/handleResumeClick
    // do: `status` is stale inside both synchronous invocations' closures
    // until React re-renders, so only a ref mutated immediately can stop a
    // second concurrent Start from opening a second mic stream and calling
    // startSessionRecording twice.
    if (status !== 'idle' || actionPendingRef.current) return;
    actionPendingRef.current = true;
    setErrorMessage(null);
    // Never hold two open streams on the same device — the pre-recording
    // check (if the trainer ran one) must release its stream before the
    // real recording stream is requested.
    stopMonitoring();
    // Channel-preserving capture only activates when Settings actually has
    // a channel→speaker mapping configured (see the `channelRoleMap` prop
    // doc comment) — every recording without one gets the exact default
    // `getUserMedia` constraints this always used, processing (echo
    // cancellation/noise suppression/AGC) left on, unchanged.
    const wantsMultiChannel = channelRoleMap.length > 0;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: wantsMultiChannel
          ? {
              ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
              channelCount: { ideal: MAX_MAPPED_CHANNELS },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : deviceId
            ? { deviceId: { exact: deviceId } }
            : true,
      });
      mediaStreamRef.current = stream;
      await refreshDevices();

      // A disconnected/unplugged mic must not leave the session silently
      // "recording" nothing — finalize with whatever was already captured
      // rather than orphaning the session in-progress.
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          setErrorMessage(
            'The microphone disconnected. Recording has stopped automatically — everything captured so far is safely saved and will be processed.',
          );
          setStatus('error');
          const lanes = channelLanesRef.current;
          if (lanes) {
            const active = lanes.filter(
              (lane) => lane.recorder && lane.recorder.state !== 'inactive',
            );
            if (active.length > 0) {
              stopReasonRef.current = 'final';
              pendingLaneStopsRef.current = active.length;
              for (const lane of active) lane.recorder!.stop();
            }
          } else if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            stopReasonRef.current = 'final';
            recorderRef.current.stop();
          }
          releaseCaptureResources();
        };
      });

      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      // 2048 gives startMeterLoop's time-domain peak/clipping read enough
      // resolution to catch a real transient rather than smoothing it away.
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      startMeterLoop();

      // Whatever Chrome actually negotiated — never assumed. `channelCount`
      // above is a request, not a guarantee (see `media-device-audio-
      // source.ts`'s doc comment on the same honesty requirement for the
      // pre-recording monitor). Only when the trainer's org has a channel
      // mapping configured *and* the browser genuinely delivered more than
      // one channel does this session capture per-channel; otherwise it's
      // byte-for-byte the single-mixed-track path every session used before
      // channel-preserving capture existed.
      const negotiatedChannelCount = stream.getAudioTracks()[0]?.getSettings().channelCount ?? 1;
      if (wantsMultiChannel && negotiatedChannelCount > 1) {
        const splitter = audioContext.createChannelSplitter(negotiatedChannelCount);
        source.connect(splitter);
        const lanes: ChannelLane[] = [];
        for (let channelIndex = 0; channelIndex < negotiatedChannelCount; channelIndex++) {
          const destination = audioContext.createMediaStreamDestination();
          splitter.connect(destination, channelIndex, 0);
          lanes.push({ channelIndex, stream: destination.stream, recorder: null, chunkBuffer: [] });
        }
        channelLanesRef.current = lanes;
      } else {
        channelLanesRef.current = null;
      }

      preferredMimeTypeRef.current = pickSupportedMimeType();
      chunkIndexRef.current = 0;
      chunkStartOffsetRef.current = 0;
      uploadPromisesRef.current = [];
      resetPauseTracking();

      elapsedRef.current = 0;
      setElapsed(0);
      timerIntervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);

      armMaxDurationStop(MAX_SESSION_DURATION_SECONDS * 1000);

      startNextChunkRecorder();

      // MediaRecorder is now actually capturing — only now does the
      // server-side session transition draft -> recording. Deferring this
      // any further (e.g. until chunk 0 finishes uploading) is what
      // previously made Pause fail for the first CHUNK_DURATION_SECONDS of
      // every session: the server rejected pause/resume while it still
      // thought the session was `draft`.
      const started = await startSessionRecording({ sessionId: session.id });
      if (!started.ok) {
        // Server refused the start (e.g. the session was already used or
        // deleted from another tab) — unwind the local recorder(s) without
        // letting their normal onstop handler treat this as a real finished
        // chunk to upload.
        const lanes = channelLanesRef.current;
        if (lanes) {
          for (const lane of lanes) {
            if (!lane.recorder) continue;
            lane.recorder.onstop = null;
            if (lane.recorder.state !== 'inactive') lane.recorder.stop();
            lane.recorder = null;
          }
        } else if (recorderRef.current) {
          recorderRef.current.onstop = null;
          if (recorderRef.current.state !== 'inactive') recorderRef.current.stop();
          recorderRef.current = null;
        }
        releaseCaptureResources();
        setErrorMessage(started.error.message);
        setStatus('error');
        return;
      }

      setStatus('recording');
    } catch (error) {
      // Whatever got acquired before the failure (mic stream, AudioContext)
      // must be released here too — otherwise the browser's mic indicator
      // stays lit and a retry opens a second stream on top of the first.
      releaseCaptureResources();
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not access the selected microphone.',
      );
      setStatus('error');
    } finally {
      actionPendingRef.current = false;
    }
  }

  function resetPauseTracking() {
    setPausedTotalSeconds(0);
    setPauseCount(0);
    setCurrentPauseSeconds(0);
    pauseStartedAtRef.current = null;
  }

  /** Pause: freezes the elapsed/rollover/max-duration timers, natively
   * pauses the current chunk's MediaRecorder (no audio captured, no upload
   * triggered), and tells the server first so a lost network request can
   * never leave the browser "paused" while the server still thinks the
   * session is recording. */
  async function handlePauseClick() {
    if (
      status !== 'recording' ||
      (!recorderRef.current && !channelLanesRef.current) ||
      actionPendingRef.current
    )
      return;
    actionPendingRef.current = true;
    setIsTransitioning(true);
    try {
      const outcome = await pauseSessionRecording({ sessionId: session.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (meterIntervalRef.current) {
        clearInterval(meterIntervalRef.current);
        meterIntervalRef.current = null;
      }
      setLevel(0);

      if (rolloverTimeoutRef.current) {
        clearTimeout(rolloverTimeoutRef.current);
        rolloverTimeoutRef.current = null;
      }
      rolloverRemainingMsRef.current = rolloverPendingRef.current
        ? Math.max(0, rolloverDeadlineRef.current - Date.now())
        : 0;

      if (maxDurationTimeoutRef.current) {
        clearTimeout(maxDurationTimeoutRef.current);
        maxDurationTimeoutRef.current = null;
      }
      maxDurationRemainingMsRef.current = Math.max(0, maxDurationDeadlineRef.current - Date.now());

      const lanes = channelLanesRef.current;
      if (lanes) {
        for (const lane of lanes) if (lane.recorder?.state === 'recording') lane.recorder.pause();
      } else if (recorderRef.current?.state === 'recording') {
        recorderRef.current.pause();
      }

      pauseStartedAtRef.current = Date.now();
      setCurrentPauseSeconds(0);
      pauseTickIntervalRef.current = setInterval(() => {
        setCurrentPauseSeconds(
          Math.round((Date.now() - (pauseStartedAtRef.current ?? Date.now())) / 1000),
        );
      }, 1000);

      setPauseCount((n) => n + 1);
      setStatus('paused');
    } finally {
      actionPendingRef.current = false;
      setIsTransitioning(false);
    }
  }

  /** Resume: same server-first ordering as pause, then natively resumes the
   * same MediaRecorder (continuing the same chunk — no new chunk boundary)
   * and re-arms whatever time was left on the rollover/max-duration timers. */
  async function handleResumeClick() {
    if (
      status !== 'paused' ||
      (!recorderRef.current && !channelLanesRef.current) ||
      actionPendingRef.current
    )
      return;

    const track = mediaStreamRef.current?.getAudioTracks()[0];
    if (!track || track.readyState === 'ended') {
      setErrorMessage(
        'The microphone is no longer connected. Stop this recording — everything captured so far is safely saved — then start a new session once a microphone is available.',
      );
      setStatus('error');
      return;
    }

    actionPendingRef.current = true;
    setIsTransitioning(true);
    try {
      const outcome = await resumeSessionRecording({ sessionId: session.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }

      if (pauseTickIntervalRef.current) {
        clearInterval(pauseTickIntervalRef.current);
        pauseTickIntervalRef.current = null;
      }
      const pausedSeconds = pauseStartedAtRef.current
        ? Math.round((Date.now() - pauseStartedAtRef.current) / 1000)
        : 0;
      setPausedTotalSeconds((total) => total + pausedSeconds);
      pauseStartedAtRef.current = null;
      setCurrentPauseSeconds(0);

      const lanes = channelLanesRef.current;
      if (lanes) {
        for (const lane of lanes) if (lane.recorder?.state === 'paused') lane.recorder.resume();
      } else if (recorderRef.current?.state === 'paused') {
        recorderRef.current.resume();
      }

      timerIntervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);

      if (rolloverPendingRef.current) {
        rolloverDeadlineRef.current = Date.now() + rolloverRemainingMsRef.current;
        rolloverTimeoutRef.current = setTimeout(
          rolloverToNextChunk,
          Math.max(0, rolloverRemainingMsRef.current),
        );
      }
      armMaxDurationStop(maxDurationRemainingMsRef.current);
      startMeterLoop();

      setStatus('recording');
    } finally {
      actionPendingRef.current = false;
      setIsTransitioning(false);
    }
  }

  function handleStopClick() {
    if (
      (status !== 'recording' && status !== 'paused') ||
      (!recorderRef.current && !channelLanesRef.current)
    )
      return;
    stopReasonRef.current = 'final';
    // Timers only — the mic track and AudioContext stay alive until
    // `handleChunkRecorderStop`/`handleLaneRecorderStop`'s `onstop` handler
    // releases them, so the final chunk's `MediaRecorder.stop()` has a live
    // stream to flush its last `dataavailable` from (see the comment there).
    stopCaptureTimers();
    const lanes = channelLanesRef.current;
    if (lanes) {
      const active = lanes.filter((lane) => lane.recorder && lane.recorder.state !== 'inactive');
      pendingLaneStopsRef.current = active.length;
      for (const lane of active) lane.recorder!.stop();
    } else if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setStatus('uploading');
  }

  // Tab ownership — see `deriveRecorderViewMode`'s doc comment in logic.ts
  // for the full reasoning. In short: `status !== 'idle'` is this tab's own
  // proof it holds a live MediaRecorder, and always wins over whatever the
  // (possibly stale) `session.status` prop says.
  const viewMode = deriveRecorderViewMode(status, session.status);
  if (viewMode === 'hidden') {
    return null;
  }
  if (viewMode === 'non-controlling') {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          This session is currently{' '}
          <strong className="font-medium text-foreground">{session.status}</strong> in another
          browser tab. Recording controls (Pause, Resume, Stop) are only available in the tab where{' '}
          <strong className="font-medium text-foreground">Start recording</strong> was clicked — go
          back to that tab to control it. Anything already uploaded is safely saved. If that tab was
          closed, a System Administrator can stop this session without losing the recording,
          transcript, or summary generated so far.
        </CardContent>
      </Card>
    );
  }

  const totalPausedSecondsSoFar =
    pausedTotalSeconds + (status === 'paused' ? currentPauseSeconds : 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recording</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <StatusBadge
                kind={
                  status === 'idle'
                    ? 'neutral'
                    : status === 'recording'
                      ? 'success'
                      : status === 'paused'
                        ? 'progress'
                        : status === 'uploading'
                          ? 'info'
                          : 'danger'
                }
                label={
                  status === 'idle'
                    ? 'Stopped'
                    : status === 'recording'
                      ? 'Recording'
                      : status === 'paused'
                        ? 'Paused'
                        : status === 'uploading'
                          ? 'Saving…'
                          : 'Error'
                }
              />
              <span className="font-mono text-2xl font-semibold tabular-nums">
                {formatDuration(elapsed)}
              </span>
            </div>
            {status === 'paused' ? (
              <p className="text-xs font-medium text-status-progress">
                Paused for {formatDuration(currentPauseSeconds)} — no audio is being recorded
              </p>
            ) : null}
            {status === 'recording' || status === 'paused' || status === 'uploading' ? (
              <p className="text-xs text-muted-foreground">
                Active recording: {formatDuration(elapsed)} · Paused:{' '}
                {formatDuration(totalPausedSecondsSoFar)} · Pauses: {pauseCount}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {status === 'idle' ? (
              <Button onClick={() => void handleStart()}>
                <Mic aria-hidden />
                Start recording
              </Button>
            ) : status === 'recording' ? (
              <>
                <Button
                  variant="outline"
                  disabled={isTransitioning}
                  onClick={() => void handlePauseClick()}
                >
                  <Pause aria-hidden />
                  Pause
                </Button>
                <Button variant="destructive" disabled={isTransitioning} onClick={handleStopClick}>
                  <Square aria-hidden />
                  Stop recording
                </Button>
              </>
            ) : status === 'paused' ? (
              <>
                <Button disabled={isTransitioning} onClick={() => void handleResumeClick()}>
                  <Play aria-hidden />
                  Resume
                </Button>
                <Button variant="destructive" disabled={isTransitioning} onClick={handleStopClick}>
                  <Square aria-hidden />
                  Stop recording
                </Button>
              </>
            ) : (
              <Button disabled loading={status === 'uploading'}>
                Saving…
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recorder-device">Microphone</Label>
          <Select value={deviceId} onValueChange={setDeviceId} disabled={status !== 'idle'}>
            <SelectTrigger id="recorder-device">
              <SelectValue placeholder="Default microphone" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device, index) => (
                <SelectItem key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                  {device.label ? ` — ${RECORDING_SOURCE_LABELS[device.kind]}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            USB audio interfaces, wireless receivers, and professional mixers all appear here once
            connected — the browser lists them as standard audio input devices. Sessions can run up
            to {MAX_SESSION_DURATION_SECONDS / 60} minutes of active recording — pausing for a break
            doesn&apos;t count against that limit.
          </p>
        </div>

        {status === 'idle' ? (
          <div className="space-y-3 rounded-lg border border-dashed border-input p-4">
            <div className="flex items-center justify-between gap-3">
              <Label>Device check</Label>
              {monitorStatus === 'active' || monitorStatus === 'starting' ? (
                <Button type="button" variant="outline" size="sm" onClick={stopMonitoring}>
                  Stop check
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!deviceId}
                  onClick={() => void startMonitoring()}
                >
                  <Activity aria-hidden />
                  Check microphone
                </Button>
              )}
            </div>

            {monitorStatus === 'starting' ? (
              <p className="text-xs text-muted-foreground">Opening the selected device…</p>
            ) : monitorStatus === 'active' ? (
              <>
                <div className="grid gap-1 rounded-md border border-border/60 p-2 text-xs sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Input device: </span>
                    <span className="font-medium">
                      {monitorDeviceInfo?.label || 'Unknown device'}
                      {monitorDeviceInfo
                        ? ` (${RECORDING_SOURCE_LABELS[monitorDeviceInfo.kind]})`
                        : ''}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Channel count: </span>
                    <span className="font-medium">{monitorDeviceInfo?.channelCount ?? '—'}</span>
                  </p>
                  {monitorDeviceInfo?.sampleRate ? (
                    <p>
                      <span className="text-muted-foreground">Sample rate: </span>
                      <span className="font-medium">
                        {monitorDeviceInfo.sampleRate.toLocaleString()} Hz
                      </span>
                    </p>
                  ) : null}
                </div>

                <AudioMeterBar label="Monitoring level" level={monitorLevel} peak={monitorPeak} />
                {monitorQuality && monitorQuality.status !== 'ok' ? (
                  <QualityWarningNote warning={monitorQuality} />
                ) : null}

                {monitorPerChannel && monitorPerChannel.length > 1 ? (
                  <div className="space-y-3 rounded-md border border-border/60 p-2">
                    <p className="text-xs font-medium">
                      Detected channels ({monitorPerChannel.length})
                    </p>
                    <div className="space-y-2">
                      {monitorPerChannel.map((channel, index) => (
                        <AudioMeterBar
                          key={index}
                          label={`Channel ${index}`}
                          level={channel.level}
                          peak={channel.peak}
                        />
                      ))}
                    </div>

                    <div className="space-y-2 rounded-md bg-secondary/40 p-2.5">
                      <p className="text-xs font-medium">Hardware mapping test</p>
                      <p className="text-xs text-muted-foreground">
                        Test each microphone separately. Speak into only <strong>one</strong>{' '}
                        microphone at a time and watch which channel meter above moves — then record
                        it below. Channel numbers are 0-based, matching AI Intelligence Settings.
                      </p>
                      <ul className="space-y-1.5">
                        {MIC_ROLES.map((role) => (
                          <li key={role} className="flex flex-wrap items-center gap-2">
                            <label className="flex min-w-48 items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                className="size-3.5 shrink-0 rounded border-input accent-gold"
                                checked={channelTestResults[role].tested}
                                onChange={(event) =>
                                  setChannelTestResults((prev) => ({
                                    ...prev,
                                    [role]: { ...prev[role], tested: event.target.checked },
                                  }))
                                }
                              />
                              {MIC_ROLE_LABELS[role]} tested
                            </label>
                            <span className="text-xs text-muted-foreground">→ Channel</span>
                            <select
                              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
                              aria-label={`${MIC_ROLE_LABELS[role]} observed channel`}
                              value={channelTestResults[role].channel ?? ''}
                              onChange={(event) =>
                                setChannelTestResults((prev) => ({
                                  ...prev,
                                  [role]: {
                                    ...prev[role],
                                    channel:
                                      event.target.value === '' ? null : Number(event.target.value),
                                  },
                                }))
                              }
                            >
                              <option value="">?</option>
                              {monitorPerChannel.map((_, index) => (
                                <option key={index} value={index}>
                                  {index}
                                </option>
                              ))}
                            </select>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">
                        This records your observations on-screen only, for you to report back — it
                        doesn&apos;t save anything yet. Recording still captures a single mixed
                        track until channel-preserving capture is implemented; the confirmed mapping
                        above is exactly what AI Intelligence Settings will need once it is.
                      </p>
                    </div>
                  </div>
                ) : null}

                <ul className="grid gap-1.5 sm:grid-cols-2">
                  <HealthCheckRow ok={monitorHealth?.connected ?? false} label="Device connected" />
                  <HealthCheckRow
                    ok={monitorHealth?.signalPresent ?? false}
                    label="Audio signal present"
                  />
                  <HealthCheckRow
                    ok={monitorHealth?.sampleRateSupported ?? false}
                    label="Sample rate supported"
                  />
                  <HealthCheckRow ok={monitorHealth?.ready ?? false} label="Recording ready" />
                </ul>
                {!monitorPerChannel || monitorPerChannel.length <= 1 ? (
                  <p className="flex items-start gap-1.5 text-xs font-medium text-status-progress">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Speaker separation unavailable — the selected device is providing a mixed audio
                    stream.
                    {monitorDeviceInfo?.channelCount && monitorDeviceInfo.channelCount > 1
                      ? ` It reports ${monitorDeviceInfo.channelCount} channels, but this browser session only received them already mixed together.`
                      : ''}{' '}
                    Speaker labels in the transcript will be AI-estimated from wording, not
                    identified from a microphone.
                  </p>
                ) : null}
              </>
            ) : monitorStatus === 'error' ? (
              <p className="text-xs text-destructive">{monitorError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Run a quick check before recording — confirms the device is connected, receiving
                signal, and at a good level. Sample rate and channel count show once checked.
              </p>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label id="recorder-level-label">Audio level</Label>
            {status === 'paused' ? (
              <span className="text-xs font-medium text-status-progress">Paused</span>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-labelledby="recorder-level-label"
            aria-valuenow={status === 'paused' ? 0 : level}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={status === 'paused' ? 'Paused' : undefined}
            className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-100 ease-out',
                status === 'paused' ? 'w-full bg-status-neutral/40' : 'bg-gold',
                clipping && status !== 'paused' ? 'bg-destructive' : null,
              )}
              style={status === 'paused' ? undefined : { width: `${level}%` }}
            />
          </div>
          {status === 'recording' && peak > 0 ? (
            <p className="text-xs text-muted-foreground">Peak: {peak}%</p>
          ) : null}
          {status === 'recording' && qualityWarning && qualityWarning.status !== 'ok' ? (
            <QualityWarningNote warning={qualityWarning} />
          ) : null}
        </div>

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Live level + peak-hold bar, shared shape between the pre-recording
 * device check and (via the plain progressbar above) active recording. */
function AudioMeterBar({ label, level, peak }: { label: string; level: number; peak: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>Peak {peak}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={level}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-100 ease-out"
          style={{ width: `${level}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/60"
          style={{ left: `${Math.min(99, peak)}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function HealthCheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-status-success" aria-hidden />
      ) : (
        <XCircle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className={ok ? undefined : 'text-muted-foreground'}>{label}</span>
    </li>
  );
}

function QualityWarningNote({ warning }: { warning: { status: string; message: string | null } }) {
  if (!warning.message) return null;
  const isSevere = warning.status === 'clipping' || warning.status === 'disconnected';
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-xs font-medium',
        isSevere ? 'text-destructive' : 'text-status-progress',
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {warning.message}
    </p>
  );
}
