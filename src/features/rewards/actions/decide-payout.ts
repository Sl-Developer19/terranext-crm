'use server';

import { formatPaise } from '@/features/catalogue/logic';
import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { notifyPartner } from '@/lib/notifications/partner-notifications';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { decidePayoutRecord, markPayoutPaidRecord } from '../repository';
import {
  decidePayoutSchema,
  markPayoutPaidSchema,
  type DecidePayoutInput,
  type MarkPayoutPaidInput,
} from '../schema';

/** Approves or rejects a requested payout (Doc 25 §9/§13) — Founder/Finance only. */
export async function decidePayout(input: DecidePayoutInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'rewards:approve')) return permissionError();

  const parsed = decidePayoutSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid input.' });
  const { payoutId, decision, reason } = parsed.data;

  const outcome = await decidePayoutRecord(payoutId, decision, session.uid, reason || undefined);
  if (outcome === 'not_found') return notFoundError('Payout request not found.');
  if (outcome === 'not_pending')
    return conflictError('This payout request has already been decided.');

  await writeAudit({
    actorUid: session.uid,
    actorRole: session.role,
    action: 'status_change',
    entityType: 'payout_request',
    entityId: payoutId,
    entityPath: `payoutRequests/${payoutId}`,
    changes: {
      status: { before: 'requested', after: decision === 'approve' ? 'approved' : 'rejected' },
    },
    context: reason ? { feature: 'rewards', reason } : { feature: 'rewards' },
  });

  return ok({ ok: true });
}

/** Finalizes an approved payout: debits the wallet and marks the ledger paid (Doc 25 §13). */
export async function markPayoutPaid(input: MarkPayoutPaidInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'rewards:approve')) return permissionError();

  const parsed = markPayoutPaidSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid input.' });

  try {
    const outcome = await markPayoutPaidRecord(parsed.data.payoutId);
    if (outcome.kind === 'not_found') return notFoundError('Payout request not found.');
    if (outcome.kind === 'not_approved') {
      return conflictError('Only an approved payout can be marked as paid.');
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'payout_request',
      entityId: parsed.data.payoutId,
      entityPath: `payoutRequests/${parsed.data.payoutId}`,
      changes: { status: { before: 'approved', after: 'paid' } },
      context: { feature: 'rewards' },
    });

    await notifyPartner(outcome.partnerId, {
      type: 'reward_paid',
      message: `Your payout of ${formatPaise(outcome.amountPaise)} has been paid.`,
    }).catch(() => undefined);

    return ok({ ok: true });
  } catch {
    return internalError('Could not mark the payout as paid. Please try again.');
  }
}
