import type { Metadata } from 'next';
import Link from 'next/link';
import { FileBadge, GraduationCap } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LeadershipLevelsView, findLeadershipLevels } from '@/features/leadership-levels';
import {
  BrandingSettingsForm,
  GeneralSettingsForm,
  IdFormatsForm,
  getBrandingSettings,
  getGeneralSettings,
  getIdFormats,
} from '@/features/settings';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Organisation settings and ID format configuration',
};

/**
 * S53 — Settings (Doc 16 S53).
 * Org info, ID formats, notification templates (Phase 10 later).
 * Only system_admin may configure; system_admin + founder may view.
 * Every save is audited (BR-06).
 */
export default async function SettingsPage() {
  const session = await requirePermission('settings:view');
  const canConfigure = can(session.role, 'settings:configure');

  const [generalSettings, idFormats, brandingSettings, leadershipLevels] = await Promise.all([
    getGeneralSettings(),
    getIdFormats(),
    getBrandingSettings(),
    findLeadershipLevels(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organisation information and platform configuration. Every change is audited."
      />

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Organisation</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Public-facing organisation details used in certificates and communications.
            </p>
          </div>
          {canConfigure ? (
            <GeneralSettingsForm
              defaultValues={{
                orgName: generalSettings.orgName,
                orgTagline: generalSettings.orgTagline,
                address: generalSettings.address,
                contactEmail: generalSettings.contactEmail,
                contactPhone: generalSettings.contactPhone,
                website: generalSettings.website,
                gstNumber: generalSettings.gstNumber,
                panNumber: generalSettings.panNumber,
                googleMapsUrl: generalSettings.googleMapsUrl,
                socialLinks: generalSettings.socialLinks,
              }}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ['Organisation', generalSettings.orgName],
                  ['Tagline', generalSettings.orgTagline || '—'],
                  ['Address', generalSettings.address || '—'],
                  ['Email', generalSettings.contactEmail || '—'],
                  ['Phone', generalSettings.contactPhone || '—'],
                  ['Website', generalSettings.website || '—'],
                  ['GST', generalSettings.gstNumber || '—'],
                  ['PAN', generalSettings.panNumber || '—'],
                  ['Google Maps', generalSettings.googleMapsUrl || '—'],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Branding</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Colours and logo variants used across the website, emails, certificates, and QR codes
              — admin-defined, never hardcoded.
            </p>
          </div>
          {canConfigure ? (
            <BrandingSettingsForm
              defaultValues={{
                primaryColor: brandingSettings.primaryColor,
                secondaryColor: brandingSettings.secondaryColor,
                accentColor: brandingSettings.accentColor,
                logoUrl: brandingSettings.logoUrl,
                faviconUrl: brandingSettings.faviconUrl,
                emailLogoUrl: brandingSettings.emailLogoUrl,
                certificateLogoUrl: brandingSettings.certificateLogoUrl,
                qrLogoUrl: brandingSettings.qrLogoUrl,
              }}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              {(
                [
                  ['Primary colour', brandingSettings.primaryColor],
                  ['Secondary colour', brandingSettings.secondaryColor],
                  ['Accent colour', brandingSettings.accentColor],
                  ['Logo', brandingSettings.logoUrl],
                  ['Favicon', brandingSettings.faviconUrl],
                  ['Email logo', brandingSettings.emailLogoUrl],
                  ['Certificate logo', brandingSettings.certificateLogoUrl],
                  ['QR logo', brandingSettings.qrLogoUrl],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-medium">{value || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">ID Formats</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Prefixes for auto-generated Participant IDs, certificate numbers, and receipt numbers.
            </p>
          </div>
          {canConfigure ? (
            <IdFormatsForm
              defaultValues={{
                participantPrefix: idFormats.participantPrefix,
                certificatePrefix: idFormats.certificatePrefix,
                receiptPrefix: idFormats.receiptPrefix,
                communityPartnerPrefix: idFormats.communityPartnerPrefix,
                growthPartnerPrefix: idFormats.growthPartnerPrefix,
              }}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              {(
                [
                  ['Participant ID', idFormats.participantPrefix],
                  ['Certificate No.', idFormats.certificatePrefix],
                  ['Receipt No.', idFormats.receiptPrefix],
                  ['Community Partner ID', idFormats.communityPartnerPrefix],
                  ['Growth Partner ID', idFormats.growthPartnerPrefix],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-mono font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-base font-semibold">Academies &amp; Programmes</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Every academy and programme is admin-configured — names, fees, currency, intake
              status, capacity, and certificate rules — never hardcoded. Adding one takes effect
              immediately, with no redeploy.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/programmes">
              <GraduationCap aria-hidden />
              Open catalogue
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-base font-semibold">Certificate Templates</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Upload approved certificate artwork, map dynamic fields, and assign templates to
              academies or programmes. Only APPROVED/ACTIVE versions can be used to issue
              certificates.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/settings/certificate-templates">
              <FileBadge aria-hidden />
              Open templates
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Leadership Levels</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Growth Partner recognition tiers — admin-defined, never hardcoded. The active level
              with the lowest display order becomes the default for new partner registrations.
            </p>
          </div>
          <LeadershipLevelsView levels={leadershipLevels} canManage={canConfigure} />
        </CardContent>
      </Card>
    </div>
  );
}
