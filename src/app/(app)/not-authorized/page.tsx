import type { Metadata } from 'next';

import { NoAccess } from '@/components/layout/no-access';

export const metadata: Metadata = { title: 'Access denied' };

export default async function NotAuthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ permission?: string }>;
}) {
  const { permission } = await searchParams;
  return <NoAccess permission={permission} />;
}
