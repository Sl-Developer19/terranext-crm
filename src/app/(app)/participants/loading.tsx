import { ListPageSkeleton } from '@/components/ui/list-page-skeleton';

export default function ParticipantsLoading() {
  return <ListPageSkeleton withFilters columns={6} />;
}
