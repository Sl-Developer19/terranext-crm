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

import { findProcessingJobById, retryProcessingJobRecord } from '../repository';
import { retryProcessingJobSchema, type RetryProcessingJobInput } from '../schema';

/** Manual retry for a failed job (Processing Queue) — resets the stage to
 * `queued`, which re-triggers `processAiSessionJob` (Firestore write trigger). */
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
    if (job.stage !== 'failed') {
      return validationError({ jobId: 'Only a failed job can be retried.' });
    }

    await retryProcessingJobRecord(jobId);

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
