'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { createParticipant } from '../actions/create-participant';
import { createParticipantSchema, type CreateParticipantInput } from '../schema';
import { ParticipantFormFields } from './participant-form-fields';

/** S20 create flow (Doc 16). Most participants arrive via lead conversion;
 * this covers transfers and historic records with no originating lead. */
export function CreateParticipantDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<CreateParticipantInput>({
    resolver: zodResolver(createParticipantSchema),
    defaultValues: {
      fullName: '',
      dob: '',
      phone: '',
      email: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      parentName: '',
      parentPhone: '',
      leadId: '',
    },
  });

  const onSubmit = async (values: CreateParticipantInput) => {
    setPending(true);
    try {
      const outcome = await createParticipant(values);
      if (!outcome.ok) {
        if (outcome.error.code === 'validation' && outcome.error.fields) {
          for (const [key, message] of Object.entries(outcome.error.fields)) {
            form.setError(key as keyof CreateParticipantInput, { message });
          }
        } else {
          toast.error(outcome.error.message);
        }
        return;
      }
      if (outcome.data.possibleDuplicate) {
        toast.warning(
          `Created ${outcome.data.participantId} — another participant already uses this phone number.`,
        );
      } else {
        toast.success(`Participant ${outcome.data.participantId} created`);
      }
      setOpen(false);
      form.reset();
      router.push(`/participants/${encodeURIComponent(outcome.data.participantId)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden />
          New participant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New participant</DialogTitle>
          <DialogDescription>
            Creates a lifetime record with a generated Participant ID. One participant, one record —
            re-enrolment adds an enrolment, never a second record.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <ParticipantFormFields
            register={form.register}
            errors={form.formState.errors}
            defaultGender={undefined}
            onGenderChange={(value) =>
              form.setValue('gender', value as CreateParticipantInput['gender'])
            }
            idPrefix="create"
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create participant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
