'use client';

import { Mic, Square } from 'lucide-react';
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

import {
  confirmChunkUpload,
  finalizeSessionRecording,
  requestChunkUploadTicket,
} from '../actions/record-audio';
import { formatDuration } from '../logic';
import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  CHUNK_DURATION_SECONDS,
  MAX_CHUNKS_PER_SESSION,
  MAX_SESSION_DURATION_SECONDS,
  type AiSession,
  type AllowedAudioContentType,
} from '../schema';

type RecorderStatus = 'idle' | 'recording' | 'uploading' | 'error';
type StopReason = 'rollover' | 'final';

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
 * microphone stream every `CHUNK_DURATION_SECONDS` (~10 minutes), uploading
 * each finished chunk in the background while the next one is already being
 * captured. None of that is visible — device selector, live level meter,
 * timer, and Start/Stop are the entire interface, exactly as before. There
 * is still no Upload or Process control anywhere in this component.
 *
 * The rollover technique (stop one MediaRecorder, immediately start a new
 * one on the same stream) is what makes each chunk an independently valid,
 * decodable audio file — concatenated `ondataavailable` blobs from a single
 * continuous recorder are not independently valid without the others. The
 * unavoidable cost is a sub-100ms gap in the recording at each rollover
 * boundary, the standard tradeoff of this approach and far preferable to
 * ever holding 90 minutes of audio in memory at once client- or server-side.
 */
export function SessionRecorder({ session }: { session: AiSession }) {
  const router = useRouter();
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState('');
  const [status, setStatus] = React.useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const mediaStreamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunkBufferRef = React.useRef<Blob[]>([]);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const meterIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const rolloverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDurationTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = React.useRef(0);
  const chunkIndexRef = React.useRef(0);
  const chunkStartOffsetRef = React.useRef(0);
  const stopReasonRef = React.useRef<StopReason>('rollover');
  const uploadPromisesRef = React.useRef<Array<Promise<boolean>>>([]);
  const preferredMimeTypeRef = React.useRef<string | undefined>(undefined);

  const refreshDevices = React.useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list.filter((d) => d.kind === 'audioinput');
      setDevices(inputs);
      setDeviceId((current) => current || inputs[0]?.deviceId || '');
    } catch {
      // Labels/ids are unavailable before permission is granted in some
      // browsers — Start still works via the browser's own device prompt.
    }
  }, []);

  /** Stops every acquired hardware/timer resource — the mic light must go
   * off whenever the recorder is not actively recording, including when
   * setup fails partway through (e.g. getUserMedia succeeds but the
   * AudioContext or MediaRecorder construction throws). */
  const releaseCaptureResources = React.useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
    if (rolloverTimeoutRef.current) clearTimeout(rolloverTimeoutRef.current);
    if (maxDurationTimeoutRef.current) clearTimeout(maxDurationTimeoutRef.current);
    timerIntervalRef.current = null;
    meterIntervalRef.current = null;
    rolloverTimeoutRef.current = null;
    maxDurationTimeoutRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    audioContextRef.current = null;
    setLevel(0);
  }, []);

  React.useEffect(() => {
    void refreshDevices();
    return releaseCaptureResources;
  }, [refreshDevices, releaseCaptureResources]);

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
    const isLastAllowedChunk = chunkIndexRef.current >= MAX_CHUNKS_PER_SESSION - 1;
    if (!isLastAllowedChunk) {
      rolloverTimeoutRef.current = setTimeout(rolloverToNextChunk, CHUNK_DURATION_SECONDS * 1000);
    }
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      mediaStreamRef.current = stream;
      await refreshDevices();

      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioContextRef.current = audioContext;

      const levelData = new Uint8Array(analyser.frequencyBinCount);
      meterIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(levelData);
        const avg = levelData.reduce((sum, v) => sum + v, 0) / levelData.length;
        setLevel(Math.min(100, Math.round((avg / 255) * 100)));
      }, 100);

      preferredMimeTypeRef.current = pickSupportedMimeType();
      chunkIndexRef.current = 0;
      chunkStartOffsetRef.current = 0;
      uploadPromisesRef.current = [];

      elapsedRef.current = 0;
      setElapsed(0);
      timerIntervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);

      maxDurationTimeoutRef.current = setTimeout(() => {
        toast.warning(
          `Maximum recording length (${MAX_SESSION_DURATION_SECONDS / 60} minutes) reached — stopping automatically.`,
        );
        handleStopClick();
      }, MAX_SESSION_DURATION_SECONDS * 1000);

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

  function handleStopClick() {
    if (status !== 'recording' || !recorderRef.current) return;
    stopReasonRef.current = 'final';
    recorderRef.current.stop();
    releaseCaptureResources();
    setStatus('uploading');
  }

  if (session.status !== 'draft') {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recording</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge
              kind={status === 'recording' ? 'progress' : status === 'error' ? 'danger' : 'neutral'}
              label={
                status === 'idle'
                  ? 'Ready'
                  : status === 'recording'
                    ? 'Recording'
                    : status === 'uploading'
                      ? 'Saving…'
                      : 'Error'
              }
            />
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {formatDuration(elapsed)}
            </span>
          </div>
          {status === 'idle' ? (
            <Button onClick={() => void handleStart()}>
              <Mic aria-hidden />
              Start recording
            </Button>
          ) : status === 'recording' ? (
            <Button variant="destructive" onClick={handleStopClick}>
              <Square aria-hidden />
              Stop recording
            </Button>
          ) : (
            <Button disabled loading={status === 'uploading'}>
              Saving…
            </Button>
          )}
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
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            USB audio interfaces, wireless lapel mics, and boundary conference microphones all
            appear here once connected — the browser lists them as standard audio input devices.
            Sessions can run up to {MAX_SESSION_DURATION_SECONDS / 60} minutes.
          </p>
        </div>

        <div className="space-y-2">
          <Label id="recorder-level-label">Audio level</Label>
          <div
            role="progressbar"
            aria-labelledby="recorder-level-label"
            aria-valuenow={level}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-100 ease-out"
              style={{ width: `${level}%` }}
            />
          </div>
        </div>

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </CardContent>
    </Card>
  );
}
