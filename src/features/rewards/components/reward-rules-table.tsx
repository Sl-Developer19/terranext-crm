'use client';

import { Percent } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPaise } from '@/features/catalogue/logic';

import { setRewardRuleActive } from '../actions/manage-reward-rules';
import type { RewardRule } from '../schema';

function ruleValue(rule: RewardRule): string {
  if (rule.kind === 'flat') return rule.amountPaise !== null ? formatPaise(rule.amountPaise) : '—';
  return rule.percentBps !== null ? `${(rule.percentBps / 100).toFixed(2)}%` : '—';
}

/** Doc 25 §3 — configured reward rules; amounts are never hardcoded elsewhere. */
export function RewardRulesTable({ rules }: { rules: RewardRule[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Percent}
        headline="No reward rules configured"
        explanation="Add a rule to define how much a partner earns per programme."
      />
    );
  }

  const toggle = async (rule: RewardRule) => {
    setPendingId(rule.id);
    try {
      const outcome = await setRewardRuleActive({ ruleId: rule.id, active: !rule.active });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Programme</TableHead>
          <TableHead>Reward</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <TableRow key={rule.id}>
            <TableCell className="text-sm">{rule.programmeName ?? 'All programmes'}</TableCell>
            <TableCell className="text-sm">{ruleValue(rule)}</TableCell>
            <TableCell>
              <StatusBadge
                kind={rule.active ? 'success' : 'neutral'}
                label={rule.active ? 'Active' : 'Inactive'}
              />
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                disabled={pendingId === rule.id}
                onClick={() => toggle(rule)}
              >
                {rule.active ? 'Deactivate' : 'Activate'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
