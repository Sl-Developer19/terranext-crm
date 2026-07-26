'use client';

import { Plus } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProgrammeOption } from '@/features/catalogue';

import { createRewardRule } from '../actions/manage-reward-rules';
import type { RewardRuleKind } from '../schema';

const ALL_PROGRAMMES = '__all__';

/** Doc 25 §3 — configures a new reward rule; never edits an existing one in place. */
export function CreateRewardRuleDialog({ programmes }: { programmes: ProgrammeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [kind, setKind] = React.useState<RewardRuleKind>('flat');
  const [programmeId, setProgrammeId] = React.useState(ALL_PROGRAMMES);
  const [amount, setAmount] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setKind('flat');
    setProgrammeId(ALL_PROGRAMMES);
    setAmount('');
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter a positive number.');
      return;
    }

    setPending(true);
    try {
      const outcome = await createRewardRule(
        kind === 'flat'
          ? {
              kind: 'flat',
              programmeId: programmeId === ALL_PROGRAMMES ? null : programmeId,
              amountPaise: Math.round(numeric * 100),
              effectiveFrom: new Date().toISOString(),
            }
          : {
              kind: 'percent',
              programmeId: programmeId === ALL_PROGRAMMES ? null : programmeId,
              percentBps: Math.round(numeric * 100),
              effectiveFrom: new Date().toISOString(),
            },
      );
      if (!outcome.ok) {
        setError(outcome.error.message);
        return;
      }
      toast.success('Reward rule created');
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden />
          New reward rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New reward rule</DialogTitle>
          <DialogDescription>
            Applies to every payment recorded after it is created — never retroactive.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="programme">Programme</Label>
            <Select value={programmeId} onValueChange={setProgrammeId}>
              <SelectTrigger id="programme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PROGRAMMES}>All programmes</SelectItem>
                {programmes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind" required>
              Reward type
            </Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RewardRuleKind)}>
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat amount (₹)</SelectItem>
                <SelectItem value="percent">Percentage of payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount" required>
              {kind === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
            </Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
