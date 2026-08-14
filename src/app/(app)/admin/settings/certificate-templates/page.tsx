import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { listAcademies, listProgrammeOptions } from '@/features/catalogue';
import {
  CreateTemplateDialog,
  TemplateList,
  listTemplates,
} from '@/features/certificate-templates';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Certificate Templates' };

/**
 * Certificate Template Engine — admin list (Settings → Certificate
 * Templates). Gated on `certificates:view`; creation/editing further gated
 * on `certificates:configure` inside the actions themselves.
 */
export default async function CertificateTemplatesPage() {
  await requirePermission('certificates:view');

  const [templates, academies, programmes] = await Promise.all([
    listTemplates(),
    listAcademies(),
    listProgrammeOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate Templates"
        description="Upload approved certificate artwork once, map its dynamic fields, and reuse it for every certificate issued under an academy or programme."
        actions={<CreateTemplateDialog academies={academies} programmes={programmes} />}
      />

      <Card>
        <CardContent className="p-6">
          <TemplateList templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
