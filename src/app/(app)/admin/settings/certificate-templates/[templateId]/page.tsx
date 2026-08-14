import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { listAcademies, listProgrammeOptions } from '@/features/catalogue';
import { TemplateDetail, getTemplateDetail } from '@/features/certificate-templates';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Certificate Template' };

export default async function CertificateTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  await requirePermission('certificates:view');

  const [{ template, versions }, academies, programmes] = await Promise.all([
    getTemplateDetail(templateId),
    listAcademies(),
    listProgrammeOptions(),
  ]);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        description="Certificate template versions and lifecycle."
      />
      <TemplateDetail
        template={template}
        versions={versions}
        academies={academies}
        programmes={programmes}
      />
    </div>
  );
}
