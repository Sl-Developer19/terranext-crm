import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { listPartnerNotifications } from '@/lib/notifications/partner-notifications';
import { requirePartnerSession } from '@/lib/rbac/require-partner';

export const metadata: Metadata = { title: 'Notifications' };

/** Doc 25 §14 — a partner's own notification feed. */
export default async function PartnerNotificationsPage() {
  const session = await requirePartnerSession();
  const notifications = await listPartnerNotifications(session.partnerId);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Updates on your leads and rewards." />
      <Card>
        <CardContent className={notifications.length === 0 ? undefined : 'p-0'}>
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              headline="No notifications yet"
              explanation="You'll see updates here as your referrals progress."
            />
          ) : (
            <ol className="divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm">{n.message}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
