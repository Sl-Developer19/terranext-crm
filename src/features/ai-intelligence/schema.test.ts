import { describe, expect, it } from 'vitest';

import { MAX_MAPPED_CHANNELS, channelRoleMappingSchema, updateAiSettingsSchema } from './schema';

const baseSettings = {
  autoClassifySpeakers: true,
  notifyTrainerOnCompletion: true,
  audioRetentionDays: 365,
  defaultRecordingSource: 'laptop_microphone' as const,
};

describe('channelRoleMappingSchema', () => {
  it('accepts a valid channel row', () => {
    const result = channelRoleMappingSchema.safeParse({
      channelIndex: 0,
      role: 'trainer',
      label: 'Trainer',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a channel index outside 0..MAX_MAPPED_CHANNELS-1', () => {
    expect(
      channelRoleMappingSchema.safeParse({ channelIndex: -1, role: 'trainer', label: 'X' }).success,
    ).toBe(false);
    expect(
      channelRoleMappingSchema.safeParse({
        channelIndex: MAX_MAPPED_CHANNELS,
        role: 'trainer',
        label: 'X',
      }).success,
    ).toBe(false);
  });

  it('only ever accepts exactly two speaker identities — "trainer" and "students" — never a per-student role', () => {
    expect(
      channelRoleMappingSchema.safeParse({ channelIndex: 0, role: 'trainer', label: 'X' }).success,
    ).toBe(true);
    expect(
      channelRoleMappingSchema.safeParse({ channelIndex: 1, role: 'students', label: 'X' }).success,
    ).toBe(true);
    expect(
      channelRoleMappingSchema.safeParse({ channelIndex: 1, role: 'student_1', label: 'X' })
        .success,
    ).toBe(false);
  });

  it('rejects an unrecognized role', () => {
    const result = channelRoleMappingSchema.safeParse({
      channelIndex: 0,
      role: 'not-a-real-role',
      label: 'X',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty label', () => {
    const result = channelRoleMappingSchema.safeParse({
      channelIndex: 0,
      role: 'trainer',
      label: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateAiSettingsSchema — channelRoleMap', () => {
  it('accepts an empty mapping — the default, single-mixed-stream behavior', () => {
    const result = updateAiSettingsSchema.safeParse({ ...baseSettings, channelRoleMap: [] });
    expect(result.success).toBe(true);
  });

  it('accepts the standard 2-channel classroom rig: trainer on CH1, students on CH2', () => {
    const result = updateAiSettingsSchema.safeParse({
      ...baseSettings,
      channelRoleMap: [
        { channelIndex: 0, role: 'trainer', label: 'Trainer' },
        { channelIndex: 1, role: 'students', label: 'Students' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts multiple channels grouped into the single "students" identity — the 3-discrete-handheld-mic case', () => {
    const result = updateAiSettingsSchema.safeParse({
      ...baseSettings,
      channelRoleMap: [
        { channelIndex: 0, role: 'trainer', label: 'Trainer' },
        { channelIndex: 1, role: 'students', label: 'Students' },
        { channelIndex: 2, role: 'students', label: 'Students' },
        { channelIndex: 3, role: 'students', label: 'Students' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects mapping the same channel twice', () => {
    const result = updateAiSettingsSchema.safeParse({
      ...baseSettings,
      channelRoleMap: [
        { channelIndex: 0, role: 'trainer', label: 'Trainer' },
        { channelIndex: 0, role: 'students', label: 'Students' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more mapped channels than MAX_MAPPED_CHANNELS allows', () => {
    const channelRoleMap = Array.from({ length: MAX_MAPPED_CHANNELS + 1 }, (_, i) => ({
      channelIndex: i,
      role: 'unassigned' as const,
      label: `Channel ${i}`,
    }));
    const result = updateAiSettingsSchema.safeParse({ ...baseSettings, channelRoleMap });
    expect(result.success).toBe(false);
  });
});
