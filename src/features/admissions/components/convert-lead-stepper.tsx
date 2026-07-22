'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { cn } from '@/lib/utils/cn';

import { convertLead } from '../actions/convert-lead';
import { convertLeadSchema, type ConvertLeadInput, type DuplicateMatch } from '../schema';

interface BatchOption {
  id: string;
  label: string;
  academyId: string;
  programmeId: string;
  seatsLeft: number;
}

interface ProgrammeOption {
  id: string;
  name: string;
  academyId: string;
}

const STEPS = [
  { key: 'details', label: 'Verify details' },
  { key: 'duplicates', label: 'Duplicate check' },
  { key: 'programme', label: 'Programme & batch' },
  { key: 'confirm', label: 'Confirm' },
] as const;

/** The fields each step owns, so "Next" validates only what is on screen. */
const STEP_FIELDS: Record<number, (keyof ConvertLeadInput)[]> = {
  0: [
    'fullName',
    'dob',
    'phone',
    'email',
    'emergencyContactName',
    'emergencyContactPhone',
    'emergencyContactRelation',
  ],
  1: ['acknowledgedDuplicate'],
  2: ['academyId', 'programmeId', 'batchId'],
  3: [],
};

/** S14 — lead → participant stepper (Doc 16, BR-01/BR-02/BR-04). */
export function ConvertLeadStepper({
  leadId,
  leadName,
  defaults,
  duplicates,
  programmes,
  batches,
  recommendedProgrammeId,
}: {
  leadId: string;
  leadName: string;
  defaults: Partial<ConvertLeadInput>;
  duplicates: DuplicateMatch[];
  programmes: ProgrammeOption[];
  batches: BatchOption[];
  recommendedProgrammeId: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [confirming, setConfirming] = React.useState(false);

  const form = useForm<ConvertLeadInput>({
    resolver: zodResolver(convertLeadSchema),
    defaultValues: {
      leadId,
      fullName: '',
      dob: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      parentName: '',
      parentPhone: '',
      acknowledgedDuplicate: false,
      // The counselling recommendation is the default, not a silent lock — the
      // operator can still choose another programme, and the audit records it.
      academyId: '',
      programmeId: recommendedProgrammeId ?? '',
      batchId: '',
      ...defaults,
    },
  });

  const programmeId = form.watch('programmeId');
  const academyId = form.watch('academyId');
  const acknowledged = form.watch('acknowledgedDuplicate');

  const selectedProgramme = programmes.find((p) => p.id === programmeId);
  const eligibleBatches = batches.filter((b) => b.programmeId === programmeId);

  // Keep academy in step with programme — an academy that disagrees with the
  // chosen programme would silently mis-file the enrolment.
  React.useEffect(() => {
    if (selectedProgramme && selectedProgramme.academyId !== academyId) {
      form.setValue('academyId', selectedProgramme.academyId);
    }
  }, [selectedProgramme, academyId, form]);

  const next = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    const valid = fields.length === 0 || (await form.trigger(fields));
    if (!valid) return;
    if (step === 1 && duplicates.length > 0 && !acknowledged) {
      toast.error('Resolve the duplicate before continuing.');
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const onSubmit = async (values: ConvertLeadInput) => {
    const outcome = await convertLead(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof ConvertLeadInput, { message });
        }
        setStep(0);
      } else {
        toast.error(outcome.error.message);
      }
      setConfirming(false);
      return;
    }

    toast.success(`Participant ${outcome.data.participantId} created`);
    for (const warning of outcome.data.warnings) toast.warning(warning);
    router.push(`/participants/${outcome.data.participantId}`);
  };

  return (
    <>
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((entry, index) => (
          <li
            key={entry.key}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
              index === step
                ? 'border-primary text-foreground'
                : index < step
                  ? 'border-transparent bg-status-success/10 text-status-success'
                  : 'border-transparent text-muted-foreground',
            )}
          >
            {index < step ? <Check className="size-3.5" aria-hidden /> : null}
            {index + 1}. {entry.label}
          </li>
        ))}
      </ol>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {step === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verify details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-fullName" required>
                  Full name
                </Label>
                <Input id="c-fullName" {...form.register('fullName')} />
                {form.formState.errors.fullName ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.fullName.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-dob" required>
                  Date of birth
                </Label>
                <Input id="c-dob" type="date" {...form.register('dob')} />
                {form.formState.errors.dob ? (
                  <p className="text-xs text-destructive">{form.formState.errors.dob.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-phone" required>
                  Phone
                </Label>
                <Input id="c-phone" {...form.register('phone')} />
                {form.formState.errors.phone ? (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">Email</Label>
                <Input id="c-email" type="email" {...form.register('email')} />
                {form.formState.errors.email ? (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-gender">Gender</Label>
                <Input id="c-gender" {...form.register('gender')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-emergency-name" required>
                  Emergency contact name
                </Label>
                <Input id="c-emergency-name" {...form.register('emergencyContactName')} />
                {form.formState.errors.emergencyContactName ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.emergencyContactName.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-emergency-phone" required>
                  Emergency contact phone
                </Label>
                <Input id="c-emergency-phone" {...form.register('emergencyContactPhone')} />
                {form.formState.errors.emergencyContactPhone ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.emergencyContactPhone.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-emergency-relation" required>
                  Relation
                </Label>
                <Input id="c-emergency-relation" {...form.register('emergencyContactRelation')} />
                {form.formState.errors.emergencyContactRelation ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.emergencyContactRelation.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="c-address">Address</Label>
                <Textarea id="c-address" rows={2} {...form.register('address')} />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Duplicate check (BR-01)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {duplicates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No existing participant shares this phone number. A new permanent ID will be
                  issued.
                </p>
              ) : (
                <>
                  <div className="flex items-start gap-2 rounded-md border border-status-danger/40 bg-status-danger/5 p-3">
                    <AlertTriangle className="mt-0.5 size-4 text-status-danger" aria-hidden />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">
                        A participant already exists on this phone number.
                      </p>
                      <p className="text-muted-foreground">
                        BR-01 promises one permanent ID per person. If this is the same individual,
                        enrol them on their existing record instead of creating a second one — a
                        re-enrolment is a new enrolment, never a new participant.
                      </p>
                      <ul className="space-y-1">
                        {duplicates.map((duplicate) => (
                          <li key={duplicate.participantId}>
                            <a
                              className="underline underline-offset-2"
                              href={`/participants/${duplicate.participantId}`}
                            >
                              {duplicate.fullName} · {duplicate.participantId}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <Controller
                      control={form.control}
                      name="acknowledgedDuplicate"
                      render={({ field }) => (
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={field.value}
                          onChange={(event) => field.onChange(event.target.checked)}
                        />
                      )}
                    />
                    <span>
                      I have checked the records above and confirm this is a different person who
                      needs their own participant ID.
                    </span>
                  </label>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Programme & batch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="c-programme" required>
                  Programme
                </Label>
                <Controller
                  control={form.control}
                  name="programmeId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('batchId', '');
                      }}
                    >
                      <SelectTrigger id="c-programme">
                        <SelectValue placeholder="Select a programme" />
                      </SelectTrigger>
                      <SelectContent>
                        {programmes.map((programme) => (
                          <SelectItem key={programme.id} value={programme.id}>
                            {programme.name}
                            {programme.id === recommendedProgrammeId ? ' (recommended)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.programmeId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.programmeId.message}
                  </p>
                ) : null}
                {recommendedProgrammeId && programmeId !== recommendedProgrammeId ? (
                  <p className="text-xs text-muted-foreground">
                    This differs from the programme the counselling session recommended. That is
                    allowed, and the change is recorded in the audit trail.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="c-batch">Batch</Label>
                <Controller
                  control={form.control}
                  name="batchId"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="c-batch">
                        <SelectValue placeholder="Allocate later" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleBatches.map((batch) => (
                          <SelectItem
                            key={batch.id}
                            value={batch.id}
                            disabled={batch.seatsLeft <= 0}
                          >
                            {batch.label} · {batch.seatsLeft} seat
                            {batch.seatsLeft === 1 ? '' : 's'} left
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Capacity is re-checked when the admission commits (BR-04). Leaving this empty
                  enrols the participant without a batch, which can be allocated later.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Confirm admission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Name</div>
                  <div>{form.getValues('fullName')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Phone</div>
                  <div>{form.getValues('phone')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Programme</div>
                  <div>{selectedProgramme?.name ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Batch</div>
                  <div>
                    {eligibleBatches.find((b) => b.id === form.getValues('batchId'))?.label ??
                      'Allocate later'}
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground">
                Converting issues a permanent participant ID. It is never reissued and never reused
                — re-enrolment later adds an enrolment to this same record (BR-01).
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={() => setConfirming(true)}>
              Convert to participant
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Convert ${leadName} to a participant?`}
        consequence="This issues a permanent participant ID that is never reissued. The lead is marked admitted and the conversion is recorded in the audit trail."
        confirmLabel="Convert"
        pending={form.formState.isSubmitting}
        onConfirm={form.handleSubmit(onSubmit)}
      />
    </>
  );
}
