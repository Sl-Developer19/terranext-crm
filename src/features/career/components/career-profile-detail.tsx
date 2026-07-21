'use client';

import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquareText } from 'lucide-react';

import {
  captureCareerInterest,
  evaluateEligibility,
  logGuidanceSession,
} from '../actions/manage-career';
import {
  PASSPORT_STATUSES,
  RESUME_STATUSES,
  type CareerProfile,
  type GuidanceSession,
  type PassportStatus,
  type ResumeStatus,
} from '../schema';
import { ELIGIBILITY_BADGE, ELIGIBILITY_LABELS } from './career-profiles-table';

const PASSPORT_LABELS: Record<PassportStatus, string> = {
  none: 'None',
  applied: 'Applied',
  held: 'Held',
};
const RESUME_LABELS: Record<ResumeStatus, string> = {
  none: 'None',
  draft: 'Draft',
  reviewed: 'Reviewed',
  final: 'Final',
};

interface InterestFormValues {
  jobCategories: string;
  preferredCountries: string;
  passportStatus: PassportStatus;
  willingToRelocate: boolean;
  resumeStatus: ResumeStatus;
}

export function CareerProfileDetail({
  profile,
  sessions,
  canUpdate,
  canEvaluate,
}: {
  profile: CareerProfile;
  sessions: GuidanceSession[];
  canUpdate: boolean;
  canEvaluate: boolean;
}) {
  const router = useRouter();
  const [eligibility, setEligibility] = React.useState<'eligible' | 'not_eligible'>('eligible');
  const [note, setNote] = React.useState('');
  const [readiness, setReadiness] = React.useState(profile.readinessScore?.toString() ?? '');
  const [evaluating, setEvaluating] = React.useState(false);

  const interestForm = useForm<InterestFormValues>({
    defaultValues: {
      jobCategories: profile.jobCategories.join(', '),
      preferredCountries: profile.preferredCountries.join(', '),
      passportStatus: profile.passportStatus,
      willingToRelocate: profile.willingToRelocate,
      resumeStatus: profile.resumeStatus,
    },
  });
  const sessionForm = useForm<{ heldAt: string; notes: string; recommendation: string }>({
    defaultValues: { heldAt: new Date().toISOString().slice(0, 10), notes: '', recommendation: '' },
  });

  const onSaveInterest = async (values: InterestFormValues) => {
    const outcome = await captureCareerInterest({
      participantId: profile.participantId,
      ...values,
    });
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    toast.success('Career interest saved');
    router.refresh();
  };

  const onEvaluate = async () => {
    setEvaluating(true);
    try {
      const readinessScore = readiness.trim() === '' ? undefined : Number(readiness);
      const outcome = await evaluateEligibility({
        participantId: profile.participantId,
        eligibility,
        eligibilityNote: note,
        ...(readinessScore !== undefined ? { readinessScore } : {}),
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Eligibility recorded');
      setNote('');
      router.refresh();
    } finally {
      setEvaluating(false);
    }
  };

  const onLogSession = async (values: {
    heldAt: string;
    notes: string;
    recommendation: string;
  }) => {
    const outcome = await logGuidanceSession({ participantId: profile.participantId, ...values });
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    toast.success('Guidance session recorded');
    sessionForm.reset({ heldAt: values.heldAt, notes: '', recommendation: '' });
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Career interest</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={interestForm.handleSubmit(onSaveInterest)}
              noValidate
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="jobCategories">Preferred job categories</Label>
                  <Input
                    id="jobCategories"
                    placeholder="Hospitality, Nursing"
                    {...interestForm.register('jobCategories')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredCountries">Preferred countries</Label>
                  <Input
                    id="preferredCountries"
                    placeholder="UAE, Germany"
                    {...interestForm.register('preferredCountries')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passportStatus">Passport status</Label>
                  <Select
                    defaultValue={profile.passportStatus}
                    onValueChange={(v) =>
                      interestForm.setValue('passportStatus', v as PassportStatus)
                    }
                  >
                    <SelectTrigger id="passportStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PASSPORT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {PASSPORT_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resumeStatus">Resume status</Label>
                  <Select
                    defaultValue={profile.resumeStatus}
                    onValueChange={(v) => interestForm.setValue('resumeStatus', v as ResumeStatus)}
                  >
                    <SelectTrigger id="resumeStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESUME_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {RESUME_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="willingToRelocate"
                  type="checkbox"
                  defaultChecked={profile.willingToRelocate}
                  onChange={(e) => interestForm.setValue('willingToRelocate', e.target.checked)}
                />
                <Label htmlFor="willingToRelocate" className="font-normal">
                  Willing to relocate
                </Label>
              </div>
              {canUpdate ? (
                <Button type="submit" size="sm" loading={interestForm.formState.isSubmitting}>
                  Save
                </Button>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Career timeline (guidance sessions)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {canUpdate ? (
              <form
                onSubmit={sessionForm.handleSubmit(onLogSession)}
                noValidate
                className="space-y-3 rounded-md border p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="session-date" required>
                      Held on
                    </Label>
                    <Input id="session-date" type="date" {...sessionForm.register('heldAt')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-notes" required>
                    Notes
                  </Label>
                  <Textarea
                    id="session-notes"
                    {...sessionForm.register('notes', { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-recommendation">Counsellor recommendation</Label>
                  <Textarea
                    id="session-recommendation"
                    {...sessionForm.register('recommendation')}
                  />
                </div>
                <Button type="submit" size="sm" loading={sessionForm.formState.isSubmitting}>
                  Record session
                </Button>
              </form>
            ) : null}

            {sessions.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                headline="No guidance sessions yet"
                explanation="Record career guidance sessions to build this participant's timeline."
              />
            ) : (
              <ol className="space-y-4">
                {sessions.map((s) => (
                  <li key={s.id} className="border-l-2 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {s.heldAt ? format(new Date(s.heldAt), 'PP') : ''}
                      </span>
                      <span className="text-xs text-muted-foreground">{s.officerName ?? ''}</span>
                    </div>
                    <p className="mt-1 text-sm">{s.notes}</p>
                    {s.recommendation ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        Recommendation: {s.recommendation}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Placement eligibility (BR-09)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBadge
              kind={ELIGIBILITY_BADGE[profile.eligibility]}
              label={ELIGIBILITY_LABELS[profile.eligibility]}
            />
            {profile.eligibilityNote ? (
              <p className="text-xs text-muted-foreground">{profile.eligibilityNote}</p>
            ) : null}
            {profile.evaluatedAt ? (
              <p className="text-xs text-muted-foreground">
                Evaluated {format(new Date(profile.evaluatedAt), 'PP')}
              </p>
            ) : null}

            {canEvaluate ? (
              <div className="space-y-2 border-t pt-3">
                <Label htmlFor="eligibility-select">Decision</Label>
                <Select
                  value={eligibility}
                  onValueChange={(v) => setEligibility(v as 'eligible' | 'not_eligible')}
                >
                  <SelectTrigger id="eligibility-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eligible">Eligible</SelectItem>
                    <SelectItem value="not_eligible">Not eligible</SelectItem>
                  </SelectContent>
                </Select>
                <Label htmlFor="readiness-score">Readiness score (0–100)</Label>
                <Input
                  id="readiness-score"
                  type="number"
                  min={0}
                  max={100}
                  value={readiness}
                  onChange={(e) => setReadiness(e.target.value)}
                />
                <Label htmlFor="eligibility-note" required>
                  Recommendation / note
                </Label>
                <Textarea
                  id="eligibility-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={onEvaluate}
                  loading={evaluating}
                  disabled={note.trim().length < 10}
                >
                  Record decision
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
