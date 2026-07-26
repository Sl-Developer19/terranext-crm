'use server';

import { writeAudit } from '@/lib/audit/write';
import { getPartnerSession } from '@/lib/auth/partner-session';
import {
  conflictError,
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { createPayoutRequestRecord } from '../repository';

/** Doc 25 §13 — a partner requests payout of their entire current wallet balance. */
export async function requestPayout(): Promise<Result<{ payoutId: string; amountPaise: number }>> {
  const session = await getPartnerSession();
  if (!session) return permissionError('Sign in required.');

  try {
    const outcome = await createPayoutRequestRecord(session.partnerId);
    if (outcome.kind === 'no_balance') {
      return validationError({ form: 'You have no available balance to request a payout for.' });
    }
    if (outcome.kind === 'already_pending') {
      return conflictError('You already have a payout request in progress.');
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: 'growth_partner',
      action: 'create',
      entityType: 'payout_request',
      entityId: outcome.payoutId,
      entityPath: `payoutRequests/${outcome.payoutId}`,
      changes: { amountPaise: { before: null, after: outcome.amountPaise } },
      context: { feature: 'rewards' },
    });

    return ok({ payoutId: outcome.payoutId, amountPaise: outcome.amountPaise });
  } catch {
    return internalError('Could not submit the payout request. Please try again.');
  }
}
