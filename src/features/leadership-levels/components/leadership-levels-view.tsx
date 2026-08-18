'use client';

import { Award } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { setLeadershipLevelStatus } from '../actions/manage-leadership-level';
import type { LeadershipLevelDefinition, LevelStatus } from '../schema';
import { LeadershipLevelDialog } from './leadership-level-dialog';

/** Settings §3 — Growth Partner leadership/recognition tiers. */
export function LeadershipLevelsView({
  levels,
  canManage,
}: {
  levels: LeadershipLevelDefinition[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const toggleStatus = async (id: string, current: LevelStatus) => {
    const status: LevelStatus = current === 'active' ? 'archived' : 'active';
    setPendingId(id);
    try {
      const outcome = await setLeadershipLevelStatus({ levelId: id, status });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(status === 'archived' ? 'Archived' : 'Restored');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <LeadershipLevelDialog />
        </div>
      ) : null}
      <Card>
        <CardContent className={levels.length === 0 ? undefined : 'p-0'}>
          {levels.length === 0 ? (
            <EmptyState
              icon={Award}
              headline="No leadership levels yet"
              explanation="Create one to start recognising Growth Partners — the first active level (by display order) becomes the default for new registrations."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Partners</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((level) => (
                  <TableRow key={level.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {level.displayOrder}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {level.badgeColor ? (
                          <span
                            aria-hidden
                            className="size-3 shrink-0 rounded-full border border-border"
                            style={{ backgroundColor: level.badgeColor }}
                          />
                        ) : null}
                        <div className="font-medium">{level.name}</div>
                      </div>
                      {level.description ? (
                        <div className="max-w-md truncate text-xs text-muted-foreground">
                          {level.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs text-muted-foreground">{level.slug}</code>
                    </TableCell>
                    <TableCell className="text-sm">{level.partnerCount}</TableCell>
                    <TableCell>
                      <StatusBadge
                        kind={level.status === 'active' ? 'success' : 'neutral'}
                        label={level.status === 'active' ? 'Active' : 'Archived'}
                      />
                    </TableCell>
                    {canManage ? (
                      <TableCell className="space-x-2 text-right">
                        <LeadershipLevelDialog level={level} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === level.id}
                          onClick={() => toggleStatus(level.id, level.status)}
                        >
                          {level.status === 'active' ? 'Archive' : 'Restore'}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
