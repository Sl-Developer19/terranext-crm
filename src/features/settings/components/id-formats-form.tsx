'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateIdFormats } from '@/features/settings/actions/update-settings';
import { idFormatsSchema, type IdFormatsInput } from '@/features/settings/schema';

export function IdFormatsForm({ defaultValues }: { defaultValues: IdFormatsInput }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<IdFormatsInput>({
    resolver: zodResolver(idFormatsSchema),
    defaultValues,
  });

  async function onSubmit(data: IdFormatsInput) {
    const result = await updateIdFormats(data);
    if (result.ok) {
      toast.success('ID formats saved.');
      reset(data);
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        These prefixes are used when generating sequential IDs. Changing them after records have
        been created does not affect existing IDs — only new ones.
        <br />
        <strong className="font-medium text-foreground">
          Assumption (owner sign-off required):
        </strong>{' '}
        Receipt numbering uses Indian fiscal year convention: RCP-FY26-00001 (Apr–Mar). Contact the
        system administrator if a different format is needed.
      </p>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="settings-participant-prefix">Participant ID prefix</Label>
          <Input
            id="settings-participant-prefix"
            {...register('participantPrefix')}
            placeholder="TNX"
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">e.g. TNX → TNX-2026-00042</p>
          {errors.participantPrefix && (
            <p className="text-xs text-destructive">{errors.participantPrefix.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-certificate-prefix">Certificate number prefix</Label>
          <Input
            id="settings-certificate-prefix"
            {...register('certificatePrefix')}
            placeholder="TNXC"
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">e.g. TNXC → TNXC-2026-00107</p>
          {errors.certificatePrefix && (
            <p className="text-xs text-destructive">{errors.certificatePrefix.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-receipt-prefix">Receipt number prefix</Label>
          <Input
            id="settings-receipt-prefix"
            {...register('receiptPrefix')}
            placeholder="RCP"
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">e.g. RCP → RCP-FY26-00001</p>
          {errors.receiptPrefix && (
            <p className="text-xs text-destructive">{errors.receiptPrefix.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting} id="settings-idformats-save-btn">
          {isSubmitting ? 'Saving…' : 'Save ID formats'}
        </Button>
      </div>
    </form>
  );
}
