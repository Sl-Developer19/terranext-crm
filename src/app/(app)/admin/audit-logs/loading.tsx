import { ListPageSkeleton } from '@/components/ui/list-page-skeleton';

export default function AuditLogsLoading() {
  return <ListPageSkeleton withFilters columns={6} rows={10} />;
}
