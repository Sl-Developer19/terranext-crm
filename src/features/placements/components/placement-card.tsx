'use client';

import { formatDistanceToNow } from 'date-fns';
import * as React from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { advancePlacement } from '../actions/manage-placement';
import { PLACEMENT_STATUSES, type Placement, type PlacementStatus } from '../schema';
import { isValidTransition } from '../logic';

const STATUS_LABELS: Record<PlacementStatus, string> = {
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  placed: 'Placed',
  dropped: 'Dropped',
};

export function PlacementCard({
  placement,
  canAdvance,
}: {
  placement: Placement;
  canAdvance: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<PlacementStatus | ''>('');
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const options = PLACEMENT_STATUSES.filter((s) => isValidTransition(placement.status, s));

  const onAdvance = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const outcome = await advancePlacement({
        placementId: placement.id,
        status: target,
        note: note || undefined,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(`Moved to ${STATUS_LABELS[target]}`);
      setTarget('');
      setNote('');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="font-medium">{placement.participantName}</div>
          <div className="text-xs text-muted-foreground">{placement.participantId}</div>
        </div>
        <div className="text-sm">
          <div>{placement.employerName}</div>
          <div className="text-muted-foreground">
            {placement.jobCategory} · {placement.country}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Fee to student: <span className="font-medium text-status-success">₹0 (BR-08)</span>
          {placement.feeDisclosure.thirdPartyNotes ? (
            <p className="mt-1 italic">{placement.feeDisclosure.thirdPartyNotes}</p>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          Updated{' '}
          {placement.updatedAt
            ? formatDistanceToNow(new Date(placement.updatedAt), { addSuffix: true })
            : '—'}
        </div>

        {canAdvance && options.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <Select value={target} onValueChange={(v) => setTarget(v as PlacementStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Move to…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {target === 'dropped' ? (
              <Textarea
                placeholder="Reason for dropping (required)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            ) : null}
            <Button
              size="sm"
              className="w-full"
              disabled={!target || (target === 'dropped' && note.trim().length < 5)}
              loading={submitting}
              onClick={onAdvance}
            >
              Advance
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { STATUS_LABELS };
