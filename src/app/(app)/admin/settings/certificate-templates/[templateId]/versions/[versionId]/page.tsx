import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { TemplateEditor, getTemplateVersion } from '@/features/certificate-templates';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Template Editor' };

export default async function CertificateTemplateVersionPage({
  params,
}: {
  params: Promise<{ templateId: string; versionId: string }>;
}) {
  const { templateId, versionId } = await params;
  await requirePermission('certificates:configure');

  const version = await getTemplateVersion(templateId, versionId);
  if (!version) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Version ${version.versionNumber} Editor`}
        description="Position dynamic fields over the uploaded artwork. Coordinates are stored with this version — nothing is hardcoded."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/settings/certificate-templates/${templateId}`}>
              <ArrowLeft aria-hidden />
              Back to template
            </Link>
          </Button>
        }
      />
      <TemplateEditor templateId={templateId} version={version} />
    </div>
  );
}
