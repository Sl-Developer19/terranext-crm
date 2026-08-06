import { describe, expect, it } from 'vitest';

import {
  classifyRecordingSource,
  evaluateAudioQuality,
  evaluateDeviceHealth,
  isRecordingSourceKind,
  RECORDING_SOURCE_LABELS,
} from './device-classification';

describe('classifyRecordingSource', () => {
  it('falls back to laptop_microphone for an empty or generic label', () => {
    expect(classifyRecordingSource('')).toBe('laptop_microphone');
    expect(classifyRecordingSource('Microphone 1')).toBe('laptop_microphone');
    expect(classifyRecordingSource('Default - MacBook Pro Microphone')).toBe('laptop_microphone');
    expect(classifyRecordingSource('Realtek(R) Audio')).toBe('laptop_microphone');
  });

  it('recognises wireless receiver keywords', () => {
    expect(classifyRecordingSource('Shure BLX Wireless Receiver')).toBe('wireless_receiver');
    expect(classifyRecordingSource('DJI Mic 2 Receiver')).toBe('wireless_receiver');
    expect(classifyRecordingSource('Hollyland Lark M2')).toBe('wireless_receiver');
    expect(classifyRecordingSource('RODE Wireless GO II')).toBe('wireless_receiver');
    expect(classifyRecordingSource('Sennheiser EW-D Receiver')).toBe('wireless_receiver');
  });

  it('recognises USB audio interface keywords', () => {
    expect(classifyRecordingSource('Focusrite Scarlett 2i2 USB')).toBe('usb_audio_interface');
    expect(classifyRecordingSource('PreSonus AudioBox USB 96')).toBe('usb_audio_interface');
    expect(classifyRecordingSource('Generic USB Audio Interface')).toBe('usb_audio_interface');
  });

  it('recognises professional mixer keywords', () => {
    expect(classifyRecordingSource('Behringer XR18 Mixer')).toBe('professional_audio_mixer');
    expect(classifyRecordingSource('Yamaha MG10XU Mixing Console')).toBe(
      'professional_audio_mixer',
    );
  });

  it('falls back to the vendor default when no stronger keyword matches', () => {
    expect(classifyRecordingSource('Focusrite USB Audio CODEC')).toBe('usb_audio_interface');
    expect(classifyRecordingSource('Behringer UMC202HD')).toBe('usb_audio_interface');
    expect(classifyRecordingSource('Yamaha AG03')).toBe('professional_audio_mixer');
    expect(classifyRecordingSource('Rode NT-USB')).toBe('wireless_receiver');
    expect(classifyRecordingSource('Shure MV7')).toBe('wireless_receiver');
  });

  it('is case-insensitive', () => {
    expect(classifyRecordingSource('FOCUSRITE SCARLETT SOLO')).toBe('usb_audio_interface');
  });

  it('prefers the strongest keyword when a label could match more than one category', () => {
    // "Behringer" alone would default to usb_audio_interface, but an
    // explicit "Mixer" in the same label is the stronger, less ambiguous
    // signal and should win.
    expect(classifyRecordingSource('Behringer X32 Mixer')).toBe('professional_audio_mixer');
  });
});

describe('isRecordingSourceKind', () => {
  it('accepts every declared kind and rejects anything else', () => {
    expect(isRecordingSourceKind('laptop_microphone')).toBe(true);
    expect(isRecordingSourceKind('wireless_receiver')).toBe(true);
    expect(isRecordingSourceKind('bluetooth_headset')).toBe(false);
    expect(isRecordingSourceKind('')).toBe(false);
  });
});

describe('RECORDING_SOURCE_LABELS', () => {
  it('has a human label for every recording source kind', () => {
    expect(RECORDING_SOURCE_LABELS.laptop_microphone).toBe('Laptop microphone');
    expect(RECORDING_SOURCE_LABELS.usb_audio_interface).toBe('USB audio interface');
    expect(RECORDING_SOURCE_LABELS.wireless_receiver).toBe('Wireless receiver');
    expect(RECORDING_SOURCE_LABELS.professional_audio_mixer).toBe('Professional audio mixer');
  });
});

describe('evaluateAudioQuality', () => {
  it('reports disconnected regardless of level/peak when not connected', () => {
    const result = evaluateAudioQuality({ level: 50, peak: 50, connected: false });
    expect(result.status).toBe('disconnected');
    expect(result.message).toMatch(/disconnected/i);
  });

  it('reports clipping when peak is near the ceiling', () => {
    const result = evaluateAudioQuality({ level: 60, peak: 99, connected: true });
    expect(result.status).toBe('clipping');
    expect(result.message).toMatch(/clipping/i);
  });

  it('reports silent when peak is essentially zero', () => {
    const result = evaluateAudioQuality({ level: 1, peak: 0, connected: true });
    expect(result.status).toBe('silent');
    expect(result.message).toMatch(/no audio signal/i);
  });

  it('reports low when level is quiet but there is some signal', () => {
    const result = evaluateAudioQuality({ level: 5, peak: 20, connected: true });
    expect(result.status).toBe('low');
    expect(result.message).toMatch(/low/i);
  });

  it('reports ok for a healthy mid-range level', () => {
    const result = evaluateAudioQuality({ level: 45, peak: 60, connected: true });
    expect(result).toEqual({ status: 'ok', message: null });
  });
});

describe('evaluateDeviceHealth', () => {
  it('is ready when connected, signal is present, and sample rate is fine', () => {
    const health = evaluateDeviceHealth({
      connected: true,
      signalPresent: true,
      sampleRate: 48000,
    });
    expect(health).toEqual({
      connected: true,
      signalPresent: true,
      sampleRateSupported: true,
      ready: true,
      issues: [],
    });
  });

  it('treats an unknown (null) sample rate as supported, not a failure', () => {
    const health = evaluateDeviceHealth({ connected: true, signalPresent: true, sampleRate: null });
    expect(health.sampleRateSupported).toBe(true);
    expect(health.ready).toBe(true);
  });

  it('is not ready when disconnected, and reports the issue', () => {
    const health = evaluateDeviceHealth({
      connected: false,
      signalPresent: false,
      sampleRate: 48000,
    });
    expect(health.ready).toBe(false);
    expect(health.issues).toContain('Device is not connected.');
  });

  it('is not ready when connected but no signal has been observed yet', () => {
    const health = evaluateDeviceHealth({
      connected: true,
      signalPresent: false,
      sampleRate: 48000,
    });
    expect(health.ready).toBe(false);
    expect(health.issues.some((issue) => /no audio signal/i.test(issue))).toBe(true);
  });

  it('flags an unusually low sample rate', () => {
    const health = evaluateDeviceHealth({ connected: true, signalPresent: true, sampleRate: 4000 });
    expect(health.sampleRateSupported).toBe(false);
    expect(health.ready).toBe(false);
    expect(health.issues.some((issue) => /sample rate/i.test(issue))).toBe(true);
  });
});
