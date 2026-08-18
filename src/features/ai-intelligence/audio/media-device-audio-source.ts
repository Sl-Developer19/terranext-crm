import { MAX_MAPPED_CHANNELS } from '../schema';
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
 *
 * Channel-count honesty (AI Knowledge Capture Room Hardware Requirements):
 * `getUserMedia` is called here requesting up to `MAX_MAPPED_CHANNELS`
 * channels with echo cancellation/noise suppression/auto-gain-control all
 * disabled — that trade-off (worse echo/noise handling for the common
 * single-mic case) is scoped to *this monitor only* ("Check microphone"),
 * never the actual recording path, precisely so it can be used as a cheap,
 * reversible hardware feasibility test: plug in the real
 * receiver/interface, run the check, and read back whatever Chrome actually
 * negotiated. This class reports exactly that
 * (`track.getSettings().channelCount`), never a guess or the hardware's
 * nominal channel count — Chrome may still negotiate down to stereo or mono
 * regardless of what's requested, depending on the OS audio backend and
 * device driver, and that's the real answer, not a bug to work around here.
 */
export class MediaDeviceAudioSource implements AudioSource {
  private info: AudioDeviceInfo;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  /** One analyser per physical input channel, via a `ChannelSplitterNode` —
   * only created when the opened track actually negotiates more than one
   * channel (see the class doc comment on why that's rare under today's
   * default `getUserMedia` constraints). Empty for every device this has
   * actually been exercised against. */
  private channelAnalysers: AnalyserNode[] = [];
  private channelSplitter: ChannelSplitterNode | null = null;
  private levelIntervalId: ReturnType<typeof setInterval> | null = null;
  private peakHold = 0;
  private channelPeakHold: number[] = [];
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
    // Hardware feasibility test (see class doc comment): request as many
    // discrete channels as our channel-role mapping could ever use, with
    // every processing constraint that would otherwise clamp Chrome to
    // stereo turned off. `channelCount` is a request, not a guarantee —
    // `track.getSettings()` below reports what actually came back.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(this.info.deviceId ? { deviceId: { exact: this.info.deviceId } } : {}),
        channelCount: { ideal: MAX_MAPPED_CHANNELS },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
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

    // Real per-channel metering — only meaningful (and only ever
    // constructed) when the track actually negotiated more than one
    // channel; see the class doc comment for why that's rare today.
    const channelCount = this.info.channelCount ?? 0;
    if (channelCount > 1) {
      const splitter = audioContext.createChannelSplitter(channelCount);
      source.connect(splitter);
      const analysers: AnalyserNode[] = [];
      for (let i = 0; i < channelCount; i++) {
        const channelAnalyser = audioContext.createAnalyser();
        channelAnalyser.fftSize = 2048;
        splitter.connect(channelAnalyser, i, 0);
        analysers.push(channelAnalyser);
      }
      this.channelSplitter = splitter;
      this.channelAnalysers = analysers;
      this.channelPeakHold = new Array(channelCount).fill(0);
    }

    this.startLevelLoop();
    return stream;
  }

  /** Reads one analyser's current level/peak/clipping — shared by the
   * aggregate meter and each per-channel meter so they're computed
   * identically. `peakHoldRef`/`writePeakHold` thread through the specific
   * peak-hold slot (aggregate vs. one channel's) to decay independently. */
  private readAnalyserSample(
    analyser: AnalyserNode,
    freqData: Uint8Array<ArrayBuffer>,
    timeData: Uint8Array<ArrayBuffer>,
    previousPeakHold: number,
    writePeakHold: (next: number) => void,
  ): AudioLevelSample {
    analyser.getByteFrequencyData(freqData);
    let freqSum = 0;
    for (let i = 0; i < freqData.length; i++) freqSum += freqData[i] ?? 0;
    const level = Math.min(100, Math.round((freqSum / freqData.length / 255) * 100));

    analyser.getByteTimeDomainData(timeData);
    let maxDeviation = 0;
    for (let i = 0; i < timeData.length; i++) {
      const deviation = Math.abs((timeData[i] ?? 128) - 128);
      if (deviation > maxDeviation) maxDeviation = deviation;
    }
    const instantPeak = Math.min(100, Math.round((maxDeviation / 128) * 100));
    const peakHold =
      instantPeak > previousPeakHold ? instantPeak : Math.max(0, previousPeakHold - 3);
    writePeakHold(peakHold);
    const clipping = maxDeviation >= 126;

    return { level, peak: peakHold, clipping };
  }

  private startLevelLoop(): void {
    const analyser = this.analyser;
    if (!analyser) return;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);
    // Per-channel analysers all share the same fftSize (2048), so one pair
    // of scratch buffers is safe to reuse across every channel each tick.
    const channelFreqData = new Uint8Array(2048 / 2);
    const channelTimeData = new Uint8Array(2048);

    this.levelIntervalId = setInterval(() => {
      // Running level: frequency-domain average, same technique the
      // recorder used before this module existed — a smoothed sense of
      // "how loud right now", good for the live bar but too smoothed to
      // catch a brief clipping spike. Peak/clipping: time-domain waveform,
      // centered at 128 — a value pinned at the 0/255 rail is the actual
      // digital clipping the recording will have.
      const sample = this.readAnalyserSample(
        analyser,
        freqData,
        timeData,
        this.peakHold,
        (next) => {
          this.peakHold = next;
        },
      );

      const perChannel =
        this.channelAnalysers.length > 0
          ? this.channelAnalysers.map((channelAnalyser, i) =>
              this.readAnalyserSample(
                channelAnalyser,
                channelFreqData,
                channelTimeData,
                this.channelPeakHold[i] ?? 0,
                (next) => {
                  this.channelPeakHold[i] = next;
                },
              ),
            )
          : undefined;

      this.levelCallback?.({ ...sample, ...(perChannel ? { perChannel } : {}) });
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
    this.channelSplitter = null;
    this.channelAnalysers = [];
    this.channelPeakHold = [];
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
