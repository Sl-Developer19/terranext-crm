'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { updateParticipant } from '../actions/update-participant';
import { updateParticipantSchema, type Participant, type UpdateParticipantInput } from '../schema';
import { ParticipantFormFields } from './participant-form-fields';

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value && value.length > 0 ? value : '—'}</div>
    </div>
  );
}

/** S21 Overview tab: read view + inline edit for ops (Doc 16). */
export function ParticipantOverview({
  participant,
  canUpdate,
}: {
  participant: Participant;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);

  const form = useForm<UpdateParticipantInput>({
    resolver: zodResolver(updateParticipantSchema),
    defaultValues: {
      participantId: participant.id,
      fullName: participant.personal.fullName,
      dob: participant.personal.dob ? participant.personal.dob.slice(0, 10) : '',
      ...(participant.personal.gender ? { gender: participant.personal.gender } : {}),
      phone: participant.personal.phone,
      email: participant.personal.email ?? '',
      address: participant.personal.address ?? '',
      emergencyContactName: participant.personal.emergencyContact.name,
      emergencyContactPhone: participant.personal.emergencyContact.phone,
      emergencyContactRelation: participant.personal.emergencyContact.relation,
      parentName: participant.family.parentName ?? '',
      parentPhone: participant.family.parentPhone ?? '',
    },
  });

  const onSubmit = async (values: UpdateParticipantInput) => {
    const outcome = await updateParticipant(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof UpdateParticipantInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Participant details updated');
    setEditing(false);
    router.refresh();
  };

  if (editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit participant details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
            <ParticipantFormFields
              register={form.register}
              errors={form.formState.errors}
              defaultGender={participant.personal.gender ?? undefined}
              onGenderChange={(value) =>
                form.setValue('gender', value as UpdateParticipantInput['gender'])
              }
              idPrefix="edit"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset();
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Personal information</CardTitle>
          {canUpdate ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Detail label="Full name" value={participant.personal.fullName} />
          <Detail
            label="Date of birth"
            value={
              participant.personal.dob ? format(new Date(participant.personal.dob), 'PP') : null
            }
          />
          <Detail label="Gender" value={participant.personal.gender} />
          <Detail label="Participant ID" value={participant.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Detail label="Phone" value={participant.personal.phone} />
          <Detail label="Email" value={participant.personal.email} />
          <Detail label="Address" value={participant.personal.address} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emergency contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Detail label="Name" value={participant.personal.emergencyContact.name} />
          <Detail label="Phone" value={participant.personal.emergencyContact.phone} />
          <Detail label="Relation" value={participant.personal.emergencyContact.relation} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parent / guardian</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Detail label="Name" value={participant.family.parentName} />
          <Detail label="Phone" value={participant.family.parentPhone} />
          <Detail label="Originating lead" value={participant.leadId} />
        </CardContent>
      </Card>
    </div>
  );
}
