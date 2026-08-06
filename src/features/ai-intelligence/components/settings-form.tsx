'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
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
  RECORDING_SOURCES,
  updateAiSettingsSchema,
  type AiIntelligenceSettings,
  type UpdateAiSettingsInput,
} from '../schema';

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
    },
  });

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

            <Button type="submit" loading={form.formState.isSubmitting}>
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
