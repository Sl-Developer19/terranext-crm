'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { requestPayout } from '../actions/request-payout';

/** Doc 25 §13 — requests a payout of the partner's entire current balance. */
export function RequestPayoutButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      const outcome = await requestPayout();
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Payout requested');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button size="sm" loading={pending} disabled={disabled} onClick={onClick}>
      Request payout
    </Button>
  );
}
