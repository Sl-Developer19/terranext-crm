'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { RECORDING_SOURCE_LABELS } from '../audio/device-classification';
import { updateAiSettings } from '../actions/update-settings';
import {
  CHANNEL_ROLES,
  MAX_MAPPED_CHANNELS,
  RECORDING_SOURCES,
  updateAiSettingsSchema,
  type AiIntelligenceSettings,
  type ChannelRole,
  type UpdateAiSettingsInput,
} from '../schema';

const CHANNEL_ROLE_LABELS: Record<ChannelRole, string> = {
  trainer: 'Trainer',
  students: 'Students',
  unassigned: 'Unassigned',
};

/** Provider selection is env-controlled (AI_SPEECH_PROVIDER / AI_SUMMARY_PROVIDER
 * + secrets, see functions/src/ai/providers) — shown read-only here. This
 * form only touches operational toggles that don't require a redeploy. */
export function SettingsForm({ settings }: { settings: AiIntelligenceSettings }) {
  const router = useRouter();

  const form = useForm<UpdateAiSettingsInput>({
    resolver: zodResolver(updateAiSettingsSchema),
    defaultValues: {
      autoClassifySpeakers: settings.autoClassifySpeakers,
      notifyTrainerOnCompletion: settings.notifyTrainerOnCompletion,
      audioRetentionDays: settings.audioRetentionDays,
      defaultRecordingSource: settings.defaultRecordingSource,
      channelRoleMap: settings.channelRoleMap,
    },
  });
  const channelRows = useFieldArray({ control: form.control, name: 'channelRoleMap' });
  const nextFreeChannelIndex = () => {
    const used = new Set(form.getValues('channelRoleMap').map((r) => r.channelIndex));
    for (let i = 0; i < MAX_MAPPED_CHANNELS; i++) if (!used.has(i)) return i;
    return 0;
  };

  const onSubmit = async (values: UpdateAiSettingsInput) => {
    const outcome = await updateAiSettings(values);
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    toast.success('Settings saved');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active providers</CardTitle>
          <CardDescription>
            Set via AI_SPEECH_PROVIDER / AI_SUMMARY_PROVIDER and the matching API key secret on the
            Cloud Functions deployment — not editable from this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Speech-to-text</p>
            <Badge variant={settings.activeSpeechProvider === 'mock' ? 'outline' : 'gold'}>
              {settings.activeSpeechProvider}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">AI summarization</p>
            <Badge variant={settings.activeSummaryProvider === 'mock' ? 'outline' : 'gold'}>
              {settings.activeSummaryProvider}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processing options</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input accent-gold"
                {...form.register('autoClassifySpeakers')}
              />
              <span>
                <span className="font-medium">Auto-classify trainer &amp; student speakers</span>
                <span className="block text-xs text-muted-foreground">
                  When off, all segments are labelled &ldquo;unknown&rdquo; until reviewed manually.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-input accent-gold"
                {...form.register('notifyTrainerOnCompletion')}
              />
              <span>
                <span className="font-medium">Notify trainer when processing completes</span>
                <span className="block text-xs text-muted-foreground">
                  Session history and dashboard always update regardless of this setting.
                </span>
              </span>
            </label>

            <div className="max-w-xs space-y-2">
              <Label htmlFor="settings-retention" required>
                Audio retention (days)
              </Label>
              <Input
                id="settings-retention"
                type="number"
                min={7}
                max={3650}
                {...form.register('audioRetentionDays', { valueAsNumber: true })}
              />
              {form.formState.errors.audioRetentionDays ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.audioRetentionDays.message}
                </p>
              ) : null}
            </div>

            <div className="max-w-xs space-y-2">
              <Label htmlFor="settings-recording-source" required>
                Recording source
              </Label>
              <Controller
                control={form.control}
                name="defaultRecordingSource"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="settings-recording-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECORDING_SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {RECORDING_SOURCE_LABELS[source]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Which hardware trainers in this organization typically record with. The recording
                screen still lists every connected device and lets a trainer pick any of them — this
                only decides which one it highlights first.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Channel → speaker mapping</Label>
                <p className="text-xs text-muted-foreground">
                  Only takes effect for a multi-channel receiver/interface the browser can actually
                  expose as separate input channels — most setups (a single laptop or USB
                  microphone) never have more than one channel to map. The typical classroom rig
                  maps two channels: the trainer&apos;s headset on one, and all student handheld
                  microphones on the other — map channel 0 to Trainer and channel 1 to Students.
                  There are only ever two speaker identities, Trainer and Students; if a receiver
                  happens to expose the student microphones on separate channels instead of one
                  already-mixed channel, map every one of those channels to Students too — they all
                  still combine into the one Students identity, never separate per-student ones.
                  Channel numbers are 0-based, matching how the browser reports them during the
                  pre-recording hardware test. Leave empty to keep every session on today&apos;s
                  single-mixed-track behavior.
                </p>
              </div>
              {channelRows.fields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No channels mapped yet.</p>
              ) : (
                <ul className="space-y-2">
                  {channelRows.fields.map((field, index) => (
                    <li key={field.id} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={MAX_MAPPED_CHANNELS - 1}
                        className="w-20"
                        aria-label={`Channel ${index + 1} number`}
                        {...form.register(`channelRoleMap.${index}.channelIndex`, {
                          valueAsNumber: true,
                        })}
                      />
                      <Controller
                        control={form.control}
                        name={`channelRoleMap.${index}.role`}
                        render={({ field: roleField }) => (
                          <Select
                            value={roleField.value}
                            onValueChange={(value) => {
                              roleField.onChange(value);
                              // Keep the label in sync unless the trainer has
                              // already typed a custom one over it.
                              const currentLabel = form.getValues(`channelRoleMap.${index}.label`);
                              const isDefaultLabel =
                                Object.values(CHANNEL_ROLE_LABELS).includes(currentLabel);
                              if (!currentLabel || isDefaultLabel) {
                                form.setValue(
                                  `channelRoleMap.${index}.label`,
                                  CHANNEL_ROLE_LABELS[value as ChannelRole],
                                );
                              }
                            }}
                          >
                            <SelectTrigger
                              className="w-40"
                              aria-label={`Channel ${index + 1} role`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CHANNEL_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {CHANNEL_ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <Input
                        className="w-40"
                        placeholder="Display label"
                        aria-label={`Channel ${index + 1} label`}
                        {...form.register(`channelRoleMap.${index}.label`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove channel ${index + 1} mapping`}
                        onClick={() => channelRows.remove(index)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {form.formState.errors.channelRoleMap?.root ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.channelRoleMap.root.message}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={channelRows.fields.length >= MAX_MAPPED_CHANNELS}
                onClick={() =>
                  channelRows.append({
                    channelIndex: nextFreeChannelIndex(),
                    role: 'unassigned',
                    label: CHANNEL_ROLE_LABELS.unassigned,
                  })
                }
              >
                <Plus aria-hidden />
                Add channel
              </Button>
            </div>

            <Button type="submit" loading={form.formState.isSubmitting}>
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
