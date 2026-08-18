'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateGeneralSettings } from '@/features/settings/actions/update-settings';
import { generalSettingsSchema, type GeneralSettingsInput } from '@/features/settings/schema';

export function GeneralSettingsForm({ defaultValues }: { defaultValues: GeneralSettingsInput }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    reset,
  } = useForm<GeneralSettingsInput>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues,
  });

  async function onSubmit(data: GeneralSettingsInput) {
    const result = await updateGeneralSettings(data);
    if (result.ok) {
      toast.success('Organisation settings saved.');
      reset(data);
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="settings-org-name">Organisation name</Label>
          <Input
            id="settings-org-name"
            {...register('orgName')}
            placeholder="TerraNext Global Ventures"
          />
          {errors.orgName && <p className="text-xs text-destructive">{errors.orgName.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-org-tagline">Tagline</Label>
          <Input
            id="settings-org-tagline"
            {...register('orgTagline')}
            placeholder="Optional tagline"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="settings-address">Address</Label>
          <Input id="settings-address" {...register('address')} placeholder="Full postal address" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-contact-email">Contact email</Label>
          <Input
            id="settings-contact-email"
            type="email"
            {...register('contactEmail')}
            placeholder="admin@terranext.com"
          />
          {errors.contactEmail && (
            <p className="text-xs text-destructive">{errors.contactEmail.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-contact-phone">Contact phone (E.164)</Label>
          <Input
            id="settings-contact-phone"
            {...register('contactPhone')}
            placeholder="+919876543210"
          />
          {errors.contactPhone && (
            <p className="text-xs text-destructive">{errors.contactPhone.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-website">Website</Label>
          <Input
            id="settings-website"
            type="url"
            {...register('website')}
            placeholder="https://terranext.com"
          />
          {errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-gst">GST number</Label>
          <Input id="settings-gst" {...register('gstNumber')} placeholder="22AAAAA0000A1Z5" />
          {errors.gstNumber && (
            <p className="text-xs text-destructive">{errors.gstNumber.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-pan">PAN number</Label>
          <Input id="settings-pan" {...register('panNumber')} placeholder="ABCDE1234F" />
          {errors.panNumber && (
            <p className="text-xs text-destructive">{errors.panNumber.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="settings-google-maps">Google Maps link</Label>
          <Input
            id="settings-google-maps"
            type="url"
            {...register('googleMapsUrl')}
            placeholder="https://maps.google.com/?q=..."
          />
          {errors.googleMapsUrl && (
            <p className="text-xs text-destructive">{errors.googleMapsUrl.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">Social media</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          {(['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'] as const).map(
            (platform) => (
              <div key={platform} className="space-y-1.5">
                <Label htmlFor={`settings-social-${platform}`} className="capitalize">
                  {platform}
                </Label>
                <Input
                  id={`settings-social-${platform}`}
                  type="url"
                  {...register(`socialLinks.${platform}`)}
                  placeholder={`https://${platform}.com/...`}
                />
                {errors.socialLinks?.[platform] && (
                  <p className="text-xs text-destructive">
                    {errors.socialLinks[platform]?.message}
                  </p>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!isDirty || isSubmitting} id="settings-general-save-btn">
          {isSubmitting ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
