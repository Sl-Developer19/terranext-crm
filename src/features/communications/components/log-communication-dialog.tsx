'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { NotebookPen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
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

import { logCommunication } from '../actions/manage-communication';
import { channelLabel } from '../logic';
import {
  CHANNELS,
  DIRECTIONS,
  logCommunicationSchema,
  REF_TYPES,
  type LogCommunicationInput,
  type RecipientOption,
} from '../schema';

/** Records a message that happened outside the CRM so the log stays the whole picture. */
export function LogCommunicationDialog({ recipients }: { recipients: RecipientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<LogCommunicationInput>({
    resolver: zodResolver(logCommunicationSchema),
    defaultValues: {
      channel: 'email',
      direction: 'inbound',
      refType: 'lead',
      refId: '',
      subject: '',
      body: '',
    },
  });

  const refType = form.watch('refType');
  const scopedRecipients = recipients.filter((r) => r.refType === refType);

  const onSubmit = async (values: LogCommunicationInput) => {
    const outcome = await logCommunication(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof LogCommunicationInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Message logged');
    setOpen(false);
    form.reset();
    router.refresh();
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
        <Button variant="outline" size="sm">
          <NotebookPen aria-hidden />
          Log message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a message</DialogTitle>
          <DialogDescription>
            Record a message that was sent or received outside the CRM — a reply to a personal
            inbox, or a call-relayed message.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="log-channel" required>
                Channel
              </Label>
              <Controller
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="log-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {channelLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-direction" required>
                Direction
              </Label>
              <Controller
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="log-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIRECTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value === 'inbound' ? 'Received' : 'Sent'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-ref-type" required>
                About
              </Label>
              <Controller
                control={form.control}
                name="refType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('refId', '');
                    }}
                  >
                    <SelectTrigger id="log-ref-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REF_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value === 'lead' ? 'Lead' : 'Participant'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="log-ref-id" required>
                Person
              </Label>
              <Controller
                control={form.control}
                name="refId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="log-ref-id">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopedRecipients.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.refId ? (
                <p className="text-xs text-destructive">{form.formState.errors.refId.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="log-subject">Subject</Label>
            <Input id="log-subject" {...form.register('subject')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="log-body" required>
              What was said
            </Label>
            <Textarea id="log-body" rows={5} {...form.register('body')} />
            {form.formState.errors.body ? (
              <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save to log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
