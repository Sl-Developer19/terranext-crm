'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  notFoundError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { findProcessingJobById, findSessionMeta, retryProcessingJobRecord } from '../repository';
import { retryProcessingJobSchema, type RetryProcessingJobInput } from '../schema';

/** Manual retry for a failed job (Processing Queue) — resets the stage to
 * `queued`, which re-triggers `processAiSessionJob` (Firestore write trigger).
 * Only the owning trainer or someone holding `aiIntelligence:configure` may
 * retry — `aiIntelligence:update` alone (which every trainer has) would
 * otherwise let any trainer interfere with another trainer's failed job. */
export async function retryProcessingJob(
  input: RetryProcessingJobInput,
): Promise<Result<{ jobId: string }>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'aiIntelligence:update')) return permissionError();

  const parsed = retryProcessingJobSchema.safeParse(input);
  if (!parsed.success) return validationError({ jobId: 'Invalid job reference.' });
  const { jobId } = parsed.data;

  try {
    const job = await findProcessingJobById(jobId);
    if (!job) return notFoundError('Processing job not found.');

    const owningSession = await findSessionMeta(job.sessionId);
    const isOwner = owningSession?.trainerUid === session.uid;
    if (!isOwner && !can(session.role, 'aiIntelligence:configure')) {
      return permissionError('Only the session owner can retry this job.');
    }

    if (job.stage !== 'failed') {
      return validationError({ jobId: 'Only a failed job can be retried.' });
    }

    const retried = await retryProcessingJobRecord(jobId);
    if (!retried) {
      return validationError({
        jobId: 'This job is no longer failed — it may already be retrying.',
      });
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'ai_processing_job',
      entityId: jobId,
      entityPath: `aiProcessingJobs/${jobId}`,
      changes: { stage: { before: 'failed', after: 'queued' } },
      context: { feature: 'ai-intelligence', reason: 'manual_retry' },
    });

    return ok({ jobId });
  } catch {
    return internalError('Could not retry the job. Please try again.');
  }
}
