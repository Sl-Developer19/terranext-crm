'use client';

import { UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { allocateBatch } from '../actions/allocate-batch';
import { seatsRemaining } from '../logic';
import type { Batch } from '../schema';

/**
 * Batch allocation from a participant's enrolment (BR-04).
 *
 * Full batches are shown but disabled rather than hidden — a coordinator
 * needs to see that the batch they expected is full, not wonder why it
 * vanished. The server re-checks capacity inside a transaction regardless
 * of what this list renders.
 */
export function AllocateBatchDialog({
  participantId,
  enrolmentId,
  currentBatchId,
  batches,
}: {
  participantId: string;
  enrolmentId: string;
  currentBatchId: string | null;
  batches: Batch[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string>('');
  const [pending, setPending] = React.useState(false);

  const allocate = async () => {
    if (!selected) return;
    setPending(true);
    try {
      const outcome = await allocateBatch({ batchId: selected, participantId, enrolmentId });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Participant allocated to batch');
      setOpen(false);
      setSelected('');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UsersRound aria-hidden />
          {currentBatchId ? 'Change batch' : 'Allocate batch'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allocate to batch</DialogTitle>
          <DialogDescription>
            Capacity is enforced when you confirm — if the last seat is taken in the meantime, the
            allocation is refused rather than overbooking the batch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="allocate-batch">Batch</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="allocate-batch">
              <SelectValue placeholder="Select a batch" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((batch) => {
                const remaining = seatsRemaining(batch.enrolledCount, batch.capacity);
                const isCurrent = batch.id === currentBatchId;
                return (
                  <SelectItem
                    key={batch.id}
                    value={batch.id}
                    disabled={remaining === 0 && !isCurrent}
                  >
                    {batch.code} · {remaining === 0 ? 'full' : `${remaining} free`}
                    {isCurrent ? ' · current' : ''}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {batches.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No batches are open for allocation. Create one, or set an existing batch to planned or
              running.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={allocate} loading={pending} disabled={!selected}>
            Allocate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
