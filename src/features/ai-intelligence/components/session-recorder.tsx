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
} from '../actions/record-audio';
import {
  evaluateAudioQuality,
  evaluateDeviceHealth,
  RECORDING_SOURCE_LABELS,
} from '../audio/device-classification';
import { listAudioInputDevices, MediaDeviceAudioSource } from '../audio/media-device-audio-source';
import type { AudioDeviceInfo, AudioQualityWarning, DeviceHealthCheck } from '../audio/types';
import { formatDuration } from '../logic';
import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  CHUNK_DURATION_SECONDS,
  MAX_CHUNKS_PER_SESSION,
  MAX_SESSION_DURATION_SECONDS,
  type AiSession,
  type AllowedAudioContentType,
  type RecordingSourceKind,
} from '../schema';

type RecorderStatus = 'idle' | 'recording' | 'paused' | 'uploading' | 'error';
type StopReason = 'rollover' | 'final';
type MonitorStatus = 'idle' | 'starting' | 'active' | 'error';

/** Last device the trainer picked, remembered across sessions/page loads on
 * this browser — classroom hardware is normally plugged in once and left
 * alone, so re-selecting it every session would be pure friction. */
const LAST_DEVICE_STORAGE_KEY = 'ai-intelligence:last-audio-device-id';

const MEDIA_RECORDER_TIMESLICE_MS = 1000;
const CHUNK_UPLOAD_MAX_ATTEMPTS = 3;
const CHUNK_UPLOAD_RETRY_DELAY_MS = 1000;

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
}: {
  session: AiSession;
  /** Classroom Hardware Mode default from Settings — a hint for which
   * connected device to pre-select, never a restriction on which the
   * trainer can choose (see the comment on `RECORDING_SOURCES` in
   * `../schema.ts`). */
  defaultRecordingSource?: RecordingSourceKind;
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
  const [monitorHealth, setMonitorHealth] = React.useState<DeviceHealthCheck | null>(null);
  const [monitorQuality, setMonitorQuality] = React.useState<AudioQualityWarning | null>(null);
  const [monitorDeviceInfo, setMonitorDeviceInfo] = React.useState<AudioDeviceInfo | null>(null);
  const [monitorError, setMonitorError] = React.useState<string | null>(null);
  const monitorSourceRef = React.useRef<MediaDeviceAudioSource | null>(null);

  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunkBufferRef = React.useRef<Blob[]>([]);
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

  /** Stops every acquired hardware/timer resource — the mic light must go
   * off whenever the recorder is not actively recording, including when
   * setup fails partway through (e.g. getUserMedia succeeds but the
   * AudioContext or MediaRecorder construction throws). */
  const releaseCaptureResources = React.useCallback(() => {
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
    mediaStreamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    mediaStreamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    setLevel(0);
    setPeak(0);
    setClipping(false);
    setQualityWarning(null);
  }, []);

  const stopMonitoring = React.useCallback(() => {
    monitorSourceRef.current?.stop();
    monitorSourceRef.current = null;
    setMonitorStatus('idle');
    setMonitorLevel(0);
    setMonitorPeak(0);
    setMonitorHealth(null);
    setMonitorQuality(null);
    setMonitorDeviceInfo(null);
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
    blob: Blob,
    startOffsetSec: number,
    durationSeconds: number,
  ): Promise<boolean> {
    const contentType = normalizeContentType(blob.type);

    for (let attempt = 1; attempt <= CHUNK_UPLOAD_MAX_ATTEMPTS; attempt++) {
      try {
        const ticket = await requestChunkUploadTicket({
          sessionId: session.id,
          chunkIndex,
          contentType,
          sizeBytes: blob.size,
          startOffsetSec,
        });
        if (!ticket.ok) throw new Error(ticket.error.message);

        const response = await fetch(ticket.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': ticket.data.contentType },
          body: blob,
        });
        if (!response.ok) throw new Error('Chunk upload failed');

        const confirmed = await confirmChunkUpload({
          sessionId: session.id,
          chunkIndex,
          durationSeconds,
        });
        if (!confirmed.ok) throw new Error(confirmed.error.message);
        if (confirmed.data.status === 'failed') throw new Error('Chunk failed verification');

        return true;
      } catch {
        if (attempt === CHUNK_UPLOAD_MAX_ATTEMPTS) {
          toast.error(
            `Recording segment ${chunkIndex + 1} couldn't be saved after several attempts — check your connection.`,
          );
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, CHUNK_UPLOAD_RETRY_DELAY_MS * attempt));
      }
    }
    return false;
  }

  function startNextChunkRecorder() {
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
    recorder.start(MEDIA_RECORDER_TIMESLICE_MS);
    recorderRef.current = recorder;

    // The last allowed chunk gets no rollover of its own — only the
    // max-duration auto-stop (or the trainer) may end it. Without this, a
    // 90-minute session landing exactly on a chunk boundary could schedule
    // a rollover and the auto-stop in the same instant, producing a 10th
    // chunk one over the business-ceiling-derived limit.
    armRolloverForCurrentChunk(CHUNK_DURATION_SECONDS * 1000);
  }

  function rolloverToNextChunk() {
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
      void finalizeAfterStop(finishedChunkIndex + 1);
    }
  }

  async function finalizeAfterStop(totalChunks: number) {
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
    setErrorMessage(null);
    // Never hold two open streams on the same device — the pre-recording
    // check (if the trainer ran one) must release its stream before the
    // real recording stream is requested.
    stopMonitoring();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
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
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
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
    if (status !== 'recording' || !recorderRef.current || actionPendingRef.current) return;
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

      if (recorderRef.current.state === 'recording') recorderRef.current.pause();

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
    if (status !== 'paused' || !recorderRef.current || actionPendingRef.current) return;

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

      if (recorderRef.current.state === 'paused') recorderRef.current.resume();

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
    if ((status !== 'recording' && status !== 'paused') || !recorderRef.current) return;
    stopReasonRef.current = 'final';
    if (pauseTickIntervalRef.current) {
      clearInterval(pauseTickIntervalRef.current);
      pauseTickIntervalRef.current = null;
    }
    if (recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    releaseCaptureResources();
    setStatus('uploading');
  }

  if (session.status !== 'draft') {
    return null;
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
                <AudioMeterBar label="Monitoring level" level={monitorLevel} peak={monitorPeak} />
                {monitorQuality && monitorQuality.status !== 'ok' ? (
                  <QualityWarningNote warning={monitorQuality} />
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
                {monitorDeviceInfo ? (
                  <p className="text-xs text-muted-foreground">
                    {RECORDING_SOURCE_LABELS[monitorDeviceInfo.kind]}
                    {monitorDeviceInfo.sampleRate
                      ? ` · ${monitorDeviceInfo.sampleRate.toLocaleString()} Hz`
                      : ''}
                    {monitorDeviceInfo.channelCount
                      ? ` · ${monitorDeviceInfo.channelCount} channel${monitorDeviceInfo.channelCount === 1 ? '' : 's'}`
                      : ''}
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
