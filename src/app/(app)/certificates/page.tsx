import type { Metadata } from 'next';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CertificateRegistry,
  EligibilityQueue,
  listCertificates,
  listEligibilityQueue,
} from '@/features/certificates';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Certificates' };

/** S27 — eligibility queue and certificate registry (Doc 16, BR-03/BR-05). */
export default async function CertificatesPage() {
  const session = await requirePermission('certificates:view');
  const [queue, certificates] = await Promise.all([listEligibilityQueue(), listCertificates()]);

  const canIssue = can(session.role, 'certificates:create');
  const canApprove = can(session.role, 'certificates:approve');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description="Eligibility is recomputed from raw attendance and assessment records at issuance — never from cached summaries."
      />
      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Eligibility queue</TabsTrigger>
          <TabsTrigger value="registry">Registry</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <Card>
            <CardContent className={queue.length === 0 ? undefined : 'p-0'}>
              <EligibilityQueue
                rows={queue}
                canIssue={canIssue || canApprove}
                canOverride={canApprove}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="registry">
          <Card>
            <CardContent className={certificates.length === 0 ? undefined : 'p-0'}>
              <CertificateRegistry certificates={certificates} canRevoke={canApprove} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
