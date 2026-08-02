import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { SettingsForm, getAiSettings } from '@/features/ai-intelligence';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'AI Intelligence — Settings' };

export default async function AiSettingsPage() {
  await requirePermission('aiIntelligence:configure');

  const settings = await getAiSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configuration for the AI Intelligence Platform module."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
