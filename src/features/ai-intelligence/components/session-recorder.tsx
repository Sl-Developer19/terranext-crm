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

import { confirmAudioUpload, requestAudioUploadTicket } from '../actions/record-audio';
import { formatDuration } from '../logic';
import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  type AiSession,
  type AllowedAudioContentType,
} from '../schema';

type RecorderStatus = 'idle' | 'recording' | 'uploading' | 'error';
const CHUNK_MS = 1000;

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
 * The recording screen (AI Knowledge Capture Room Hardware Requirements):
 * device selector, live level meter, timer, and Start/Stop only — there is
 * no Upload or Process control anywhere in this component. Stopping the
 * recording drives the signed-upload ticket, the PUT, and the confirm call
 * that enqueues the automatic pipeline, in sequence, with no further input.
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
  const chunksRef = React.useRef<Blob[]>([]);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const meterIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = React.useRef(0);

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
    timerIntervalRef.current = null;
    meterIntervalRef.current = null;
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

      const preferredMimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(
        stream,
        preferredMimeType ? { mimeType: preferredMimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void handleUpload(recorder.mimeType || preferredMimeType || 'audio/webm');
      };
      recorder.start(CHUNK_MS);
      recorderRef.current = recorder;

      elapsedRef.current = 0;
      setElapsed(0);
      timerIntervalRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);

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
    recorderRef.current?.stop();
    releaseCaptureResources();
  }

  async function handleUpload(rawMimeType: string) {
    setStatus('uploading');
    const contentType = normalizeContentType(rawMimeType);
    const blob = new Blob(chunksRef.current, { type: contentType });
    const durationSeconds = elapsedRef.current;

    try {
      const ticket = await requestAudioUploadTicket({
        sessionId: session.id,
        contentType,
        sizeBytes: blob.size,
      });
      if (!ticket.ok) {
        toast.error(ticket.error.message);
        setStatus('error');
        return;
      }

      const response = await fetch(ticket.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': ticket.data.contentType },
        body: blob,
      });
      if (!response.ok) {
        toast.error('The recording could not be uploaded. Please try again.');
        setStatus('error');
        return;
      }

      const confirmed = await confirmAudioUpload({ sessionId: session.id, durationSeconds });
      if (!confirmed.ok) {
        toast.error(confirmed.error.message);
        setStatus('error');
        return;
      }

      toast.success('Recording saved — transcription and AI analysis started automatically.');
      router.refresh();
    } catch {
      toast.error('Network problem while saving the recording.');
      setStatus('error');
    }
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
