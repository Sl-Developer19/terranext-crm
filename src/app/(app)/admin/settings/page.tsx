import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  GeneralSettingsForm,
  IdFormatsForm,
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

  const [generalSettings, idFormats] = await Promise.all([getGeneralSettings(), getIdFormats()]);

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
              }}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {(
                [
                  ['Organisation', generalSettings.orgName],
                  ['Tagline', generalSettings.orgTagline || '—'],
                  ['Email', generalSettings.contactEmail || '—'],
                  ['Phone', generalSettings.contactPhone || '—'],
                  ['Website', generalSettings.website || '—'],
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
              }}
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              {(
                [
                  ['Participant ID', idFormats.participantPrefix],
                  ['Certificate No.', idFormats.certificatePrefix],
                  ['Receipt No.', idFormats.receiptPrefix],
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
    </div>
  );
}
