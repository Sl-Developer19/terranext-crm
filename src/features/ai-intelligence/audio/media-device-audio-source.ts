import { classifyRecordingSource } from './device-classification';
import type { AudioDeviceInfo, AudioLevelSample, AudioSource } from './types';

/**
 * The only `AudioSource` implementation today — see the interface's doc
 * comment in `types.ts` for what a future multi-channel mixer integration
 * would look like instead. Wraps a single `audioinput` device: laptop mic,
 * USB audio interface, or a wireless receiver's USB/analog output — the
 * browser exposes all three identically as `MediaDeviceInfo` entries, so
 * one implementation covers every device in the classroom hardware chain
 * that reaches the browser as standard input audio.
 */
export class MediaDeviceAudioSource implements AudioSource {
  private info: AudioDeviceInfo;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelIntervalId: ReturnType<typeof setInterval> | null = null;
  private peakHold = 0;
  private levelCallback: ((sample: AudioLevelSample) => void) | null = null;
  private disconnectCallback: (() => void) | null = null;

  constructor(deviceId: string, label: string) {
    this.info = {
      deviceId,
      groupId: '',
      label,
      kind: classifyRecordingSource(label),
      sampleRate: null,
      channelCount: null,
      connected: true,
    };
  }

  async start(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: this.info.deviceId ? { deviceId: { exact: this.info.deviceId } } : true,
    });
    this.stream = stream;

    const track = stream.getAudioTracks()[0];
    if (track) {
      // getUserMedia's own constraints don't report the negotiated
      // sample rate/channel count back — only the opened track's
      // getSettings() does, and only after the device is actually open.
      const settings = track.getSettings();
      this.info = {
        ...this.info,
        label: track.label || this.info.label,
        kind: classifyRecordingSource(track.label || this.info.label),
        sampleRate: settings.sampleRate ?? null,
        channelCount: settings.channelCount ?? null,
        connected: true,
      };
      track.onended = () => {
        this.info = { ...this.info, connected: false };
        this.disconnectCallback?.();
      };
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    // 2048 gives enough time-domain resolution to catch a genuine clipping
    // transient rather than smoothing it away, while staying cheap at 10
    // samples/sec.
    analyser.fftSize = 2048;
    source.connect(analyser);
    this.audioContext = audioContext;
    this.analyser = analyser;
    this.peakHold = 0;

    this.startLevelLoop();
    return stream;
  }

  private startLevelLoop(): void {
    const analyser = this.analyser;
    if (!analyser) return;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);

    this.levelIntervalId = setInterval(() => {
      // Running level: frequency-domain average, same technique the
      // recorder used before this module existed — a smoothed sense of
      // "how loud right now", good for the live bar but too smoothed to
      // catch a brief clipping spike.
      analyser.getByteFrequencyData(freqData);
      let freqSum = 0;
      for (let i = 0; i < freqData.length; i++) freqSum += freqData[i] ?? 0;
      const level = Math.min(100, Math.round((freqSum / freqData.length / 255) * 100));

      // Peak/clipping: time-domain waveform, centered at 128. Distance from
      // center approximates instantaneous amplitude; a value pinned at the
      // 0/255 rail is the actual digital clipping the recording will have.
      analyser.getByteTimeDomainData(timeData);
      let maxDeviation = 0;
      for (let i = 0; i < timeData.length; i++) {
        const deviation = Math.abs((timeData[i] ?? 128) - 128);
        if (deviation > maxDeviation) maxDeviation = deviation;
      }
      const instantPeak = Math.min(100, Math.round((maxDeviation / 128) * 100));
      // Peak-hold with slow decay so a brief transient stays visible for a
      // beat instead of vanishing on the very next 100ms sample.
      this.peakHold = instantPeak > this.peakHold ? instantPeak : Math.max(0, this.peakHold - 3);
      const clipping = maxDeviation >= 126;

      this.levelCallback?.({ level, peak: this.peakHold, clipping });
    }, 100);
  }

  stop(): void {
    if (this.levelIntervalId) {
      clearInterval(this.levelIntervalId);
      this.levelIntervalId = null;
    }
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.stream = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = null;
    this.analyser = null;
    this.peakHold = 0;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  describe(): AudioDeviceInfo {
    return this.info;
  }

  onLevel(callback: (sample: AudioLevelSample) => void): void {
    this.levelCallback = callback;
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }
}

/** Every currently connected `audioinput` device, labeled and classified —
 * capabilities stay `null` until a device is opened (see `types.ts`). */
export async function listAudioInputDevices(): Promise<AudioDeviceInfo[]> {
  const list = await navigator.mediaDevices.enumerateDevices();
  return list
    .filter((device) => device.kind === 'audioinput')
    .map((device, index) => {
      const label = device.label || `Microphone ${index + 1}`;
      return {
        deviceId: device.deviceId,
        groupId: device.groupId,
        label,
        kind: classifyRecordingSource(label),
        sampleRate: null,
        channelCount: null,
        connected: true,
      };
    });
}
