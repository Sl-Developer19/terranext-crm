'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateBrandingSettings } from '@/features/settings/actions/update-settings';
import { brandingSettingsSchema, type BrandingSettingsInput } from '@/features/settings/schema';

const COLOR_FIELDS = [
  { name: 'primaryColor', label: 'Primary colour', fallback: '#C9A227' },
  { name: 'secondaryColor', label: 'Secondary colour', fallback: '#1F6B4A' },
  { name: 'accentColor', label: 'Accent colour', fallback: '#050505' },
] as const;

const IMAGE_FIELDS = [
  { name: 'logoUrl', label: 'Logo', hint: 'Primary brand mark — header, header nav, letterhead.' },
  {
    name: 'faviconUrl',
    label: 'Favicon',
    hint: 'Browser tab icon — square, ideally 32×32 or larger.',
  },
  { name: 'emailLogoUrl', label: 'Email logo', hint: 'Shown in the header of outbound emails.' },
  {
    name: 'certificateLogoUrl',
    label: 'Certificate logo',
    hint: 'Printed on issued certificates.',
  },
  { name: 'qrLogoUrl', label: 'QR logo', hint: 'Centre overlay on generated QR codes.' },
] as const;

export function BrandingSettingsForm({ defaultValues }: { defaultValues: BrandingSettingsInput }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<BrandingSettingsInput>({
    resolver: zodResolver(brandingSettingsSchema),
    defaultValues,
  });

  async function onSubmit(data: BrandingSettingsInput) {
    const result = await updateBrandingSettings(data);
    if (result.ok) {
      toast.success('Branding settings saved.');
      reset(data);
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        {COLOR_FIELDS.map(({ name, label, fallback }) => (
          <div key={name} className="space-y-1.5">
            <Label htmlFor={`branding-${name}`}>{label}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={`branding-${name}-picker`}
                type="color"
                className="h-10 w-12 p-1"
                value={watch(name) || fallback}
                onChange={(event) => setValue(name, event.target.value, { shouldDirty: true })}
              />
              <Input id={`branding-${name}`} placeholder={fallback} {...register(name)} />
            </div>
            {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>}
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">Logo variants</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          {IMAGE_FIELDS.map(({ name, label, hint }) => {
            const value = watch(name);
            return (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={`branding-${name}`}>{label}</Label>
                <div className="flex items-center gap-3">
                  {value ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-supplied URL, not an optimizable static asset
                    <img
                      src={value}
                      alt=""
                      className="size-10 shrink-0 rounded border border-border object-contain"
                    />
                  ) : (
                    <div className="size-10 shrink-0 rounded border border-dashed border-border" />
                  )}
                  <Input
                    id={`branding-${name}`}
                    type="url"
                    placeholder="https://.../logo.png"
                    {...register(name)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{hint}</p>
                {errors[name] && (
                  <p className="text-xs text-destructive">{errors[name]?.message}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting} id="settings-branding-save-btn">
          {isSubmitting ? 'Saving…' : 'Save branding'}
        </Button>
      </div>
    </form>
  );
}
