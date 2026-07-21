import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { FeeAccountDetail, getFeeAccount, listPayments } from '@/features/fees';
import { can } from '@/lib/rbac/permissions';
import { requirePermission } from '@/lib/rbac/require';

export const metadata: Metadata = { title: 'Fee account' };

/** S40 fee account detail: plan, ledger, collection (Doc 16). */
export default async function FeeAccountPage({
  params,
}: {
  params: Promise<{ feeAccountId: string }>;
}) {
  const { feeAccountId } = await params;
  const session = await requirePermission('fees:view');

  const account = await getFeeAccount(feeAccountId);
  if (!account) notFound();

  const payments = await listPayments(account.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={account.participantName ?? account.participantId}
        description={`${account.programmeName ?? 'Programme'} · ${account.participantId}`}
      />
      <FeeAccountDetail
        account={account}
        payments={payments}
        canCollect={can(session.role, 'fees:create')}
        canApprove={can(session.role, 'fees:approve')}
      />
    </div>
  );
}
