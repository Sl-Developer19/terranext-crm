'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  notFoundError,
  ok,
  permissionError,
  preconditionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { acceptsAllocations } from '../logic';
import { allocateToBatch, findBatchById } from '../repository';
import { allocateBatchSchema, type AllocateBatchInput } from '../schema';

/**
 * Batch allocation with BR-04 capacity enforcement (Doc 19
 * `allocateBatchAction`).
 *
 * The seat check happens inside the repository transaction, not here — this
 * layer's pre-check is a fast, friendly rejection, but it is deliberately
 * NOT the enforcement point. Two coordinators clicking simultaneously both
 * pass this check; only one wins the transaction, and the loser gets a
 * `conflict`. That is the intended behaviour, and the reason the counter
 * increment cannot live outside the transaction.
 */
export async function allocateBatch(input: AllocateBatchInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'batches:assign')) return permissionError();

  const parsed = allocateBatchSchema.safeParse(input);
  if (!parsed.success) return validationError({ batchId: 'Invalid allocation request' });
  const { batchId, participantId, enrolmentId } = parsed.data;

  try {
    const batch = await findBatchById(batchId);
    if (!batch) return notFoundError('Batch not found.');
    if (!acceptsAllocations(batch.status)) {
      return preconditionError(
        'BR-04',
        `Batch ${batch.code} is ${batch.status} and no longer accepts allocations.`,
      );
    }

    const outcome = await allocateToBatch(batchId, participantId, enrolmentId, session.uid);

    if (outcome === 'batch_missing') return notFoundError('Batch or enrolment not found.');
    if (outcome === 'already_allocated') return ok({ ok: true });
    if (outcome === 'batch_full') {
      return preconditionError(
        'BR-04',
        `Batch ${batch.code} is full (${batch.capacity} of ${batch.capacity} seats taken).`,
      );
    }
    if (outcome === 'batch_not_accepting') {
      return preconditionError(
        'BR-04',
        `Batch ${batch.code} is no longer accepting allocations. Please refresh and try again.`,
      );
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'enrolment',
      entityId: enrolmentId,
      entityPath: `participants/${participantId}/enrolments/${enrolmentId}`,
      changes: { batchId: { before: null, after: batchId } },
      context: { feature: 'batches', reason: 'batch_allocation' },
    });

    return ok({ ok: true });
  } catch {
    // A transaction that exhausted its retries under contention surfaces
    // here — retryable by the user, not a data problem.
    return conflictError('That seat was taken while you were allocating. Please try again.');
  }
}
