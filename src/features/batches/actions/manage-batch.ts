'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
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

import { findProgrammeById } from '@/features/catalogue/repository';

import { generateSessionDates, schedulesOverlap } from '../logic';
import {
  createBatchRecord,
  createSessionsForDates,
  findBatchById,
  findTrainerBatches,
  isBatchCodeTaken,
  setBatchStatusRecord,
  updateBatchRecord,
} from '../repository';
import {
  batchSchema,
  setBatchStatusSchema,
  updateBatchSchema,
  type BatchInput,
  type SetBatchStatusInput,
  type UpdateBatchInput,
} from '../schema';

/** Batch CRUD (S23). Capacity is only ever moved by the allocation transaction. */

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

export async function createBatch(input: BatchInput): Promise<Result<{ id: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'batches:create')) return permissionError();

  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { programmeId, code, trainerUid, days, startTime, endTime, ...rest } = parsed.data;

  try {
    const programme = await findProgrammeById(programmeId);
    if (!programme) return validationError({ programmeId: 'Select an existing programme' });
    if (await isBatchCodeTaken(code)) {
      return conflictError('A batch with this code already exists.');
    }

    if (trainerUid) {
      const clash = (await findTrainerBatches(trainerUid)).find((other) =>
        schedulesOverlap({ days, startTime, endTime }, other.schedule),
      );
      if (clash) {
        return conflictError(
          `This trainer already runs batch ${clash.code} in an overlapping time slot.`,
        );
      }
    }

    const id = await createBatchRecord(
      {
        programmeId,
        // Denormalized from the programme so batch queries need no join.
        academyId: programme.academyId,
        code,
        trainerUid: trainerUid || null,
        days,
        startTime,
        endTime,
        ...rest,
      },
      session.uid,
      session.branchId,
    );

    // Seed the session calendar from the weekly schedule so attendance has
    // something to mark against from day one (M4 depends on these).
    const dates = generateSessionDates(rest.startDate, rest.endDate, days);
    await createSessionsForDates(id, dates, trainerUid || null, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'batch',
      entityId: id,
      entityPath: `batches/${id}`,
      context: { feature: 'batches' },
    });

    return ok({ id });
  } catch {
    return internalError('Could not create the batch. Please try again.');
  }
}

export async function updateBatch(input: UpdateBatchInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'batches:update')) return permissionError();

  const parsed = updateBatchSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { batchId, programmeId, code, trainerUid, days, startTime, endTime, ...rest } = parsed.data;

  try {
    const existing = await findBatchById(batchId);
    if (!existing) return notFoundError('Batch not found.');

    const programme = await findProgrammeById(programmeId);
    if (!programme) return validationError({ programmeId: 'Select an existing programme' });
    if (await isBatchCodeTaken(code, batchId)) {
      return conflictError('A batch with this code already exists.');
    }

    // Capacity may not be cut below the seats already taken — those
    // participants are enrolled and cannot be silently un-seated.
    if (rest.capacity < existing.enrolledCount) {
      return validationError({
        capacity: `Capacity cannot be below the ${existing.enrolledCount} participants already allocated.`,
      });
    }

    if (trainerUid) {
      const clash = (await findTrainerBatches(trainerUid, batchId)).find((other) =>
        schedulesOverlap({ days, startTime, endTime }, other.schedule),
      );
      if (clash) {
        return conflictError(
          `This trainer already runs batch ${clash.code} in an overlapping time slot.`,
        );
      }
    }

    await updateBatchRecord(
      batchId,
      {
        programmeId,
        academyId: programme.academyId,
        code,
        trainerUid: trainerUid || null,
        days,
        startTime,
        endTime,
        ...rest,
      },
      session.uid,
    );

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    if (existing.capacity !== rest.capacity) {
      changes.capacity = { before: existing.capacity, after: rest.capacity };
    }
    if (existing.trainerUid !== (trainerUid || null)) {
      changes.trainerUid = { before: existing.trainerUid, after: trainerUid || null };
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'batch',
      entityId: batchId,
      entityPath: `batches/${batchId}`,
      ...(Object.keys(changes).length > 0 ? { changes } : {}),
      context: { feature: 'batches' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the batch. Please try again.');
  }
}

export async function setBatchStatus(input: SetBatchStatusInput): Promise<Result<{ ok: true }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'batches:update')) return permissionError();

  const parsed = setBatchStatusSchema.safeParse(input);
  if (!parsed.success) return validationError({ status: 'Select a valid status' });
  const { batchId, status } = parsed.data;

  try {
    const existing = await findBatchById(batchId);
    if (!existing) return notFoundError('Batch not found.');
    if (existing.status === status) return ok({ ok: true });

    await setBatchStatusRecord(batchId, status, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'batch',
      entityId: batchId,
      entityPath: `batches/${batchId}`,
      changes: { status: { before: existing.status, after: status } },
      context: { feature: 'batches' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not change the batch status. Please try again.');
  }
}
