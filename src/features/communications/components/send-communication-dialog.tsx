'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
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

import { sendCommunication } from '../actions/manage-communication';
import { channelLabel } from '../logic';
import {
  CHANNELS,
  REF_TYPES,
  sendCommunicationSchema,
  type RecipientOption,
  type SendCommunicationInput,
} from '../schema';
import { findTemplate, templatesFor } from '../templates';

/** S41 send dialog — writes the log doc first (FR-10.3), then dispatch follows. */
export function SendCommunicationDialog({ recipients }: { recipients: RecipientOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<SendCommunicationInput>({
    resolver: zodResolver(sendCommunicationSchema),
    defaultValues: {
      channel: 'email',
      refType: 'lead',
      refId: '',
      templateKey: null,
      subject: '',
      body: '',
    },
  });

  const channel = form.watch('channel');
  const refType = form.watch('refType');
  const templates = templatesFor(channel, refType);
  const scopedRecipients = recipients.filter((r) => r.refType === refType);

  const applyTemplate = (key: string) => {
    const template = findTemplate(key);
    if (!template) return;
    form.setValue('templateKey', key);
    form.setValue('subject', template.subject ?? '');
    form.setValue('body', template.body);
  };

  const onSubmit = async (values: SendCommunicationInput) => {
    const outcome = await sendCommunication(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof SendCommunicationInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Message queued and logged');
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
        <Button size="sm">
          <Send aria-hidden />
          Send message
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send message</DialogTitle>
          <DialogDescription>
            The message is written to the communications log before it leaves the system (FR-10.3),
            so an attempt is recorded whether or not delivery succeeds.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comm-channel" required>
                Channel
              </Label>
              <Controller
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('templateKey', null);
                    }}
                  >
                    <SelectTrigger id="comm-channel">
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
              <Label htmlFor="comm-ref-type" required>
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
                      form.setValue('templateKey', null);
                    }}
                  >
                    <SelectTrigger id="comm-ref-type">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="comm-ref-id" required>
              Recipient
            </Label>
            <Controller
              control={form.control}
              name="refId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="comm-ref-id">
                    <SelectValue placeholder="Select a recipient" />
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

          {templates.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="comm-template">Template</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger id="comm-template">
                  <SelectValue placeholder="Start from a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {channel === 'email' ? (
            <div className="space-y-2">
              <Label htmlFor="comm-subject" required>
                Subject
              </Label>
              <Input id="comm-subject" {...form.register('subject')} />
              {form.formState.errors.subject ? (
                <p className="text-xs text-destructive">{form.formState.errors.subject.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="comm-body" required>
              Message
            </Label>
            <Textarea id="comm-body" rows={6} {...form.register('body')} />
            {form.formState.errors.body ? (
              <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Queue message
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
