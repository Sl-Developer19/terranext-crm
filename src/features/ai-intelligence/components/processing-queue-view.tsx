'use client';

import { ListChecks, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge, type StatusKind } from '@/components/ui/badge';
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

import { retryProcessingJob } from '../actions/retry-processing-job';
import { JOB_STAGE_LABELS, jobStageProgressPercent } from '../logic';
import type { AiJobStage, AiProcessingJob } from '../schema';
import { AutoRefresh } from './auto-refresh';

const STAGE_KIND: Record<AiJobStage, StatusKind> = {
  queued: 'neutral',
  transcribing: 'progress',
  analyzing: 'progress',
  saving: 'progress',
  completed: 'success',
  failed: 'danger',
};

export function ProcessingQueueView({
  jobs,
  canRetry,
}: {
  jobs: AiProcessingJob[];
  canRetry: boolean;
}) {
  const router = useRouter();
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    const outcome = await retryProcessingJob({ jobId });
    setRetryingId(null);
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    toast.success('Job re-queued');
    router.refresh();
  };

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        headline="Nothing in the queue"
        explanation="Jobs appear here the moment a trainer stops recording — uploading, transcribing, analysis, and saving happen automatically."
      />
    );
  }

  return (
    <>
      <AutoRefresh intervalMs={4000} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Providers</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const percent = jobStageProgressPercent(job.stage);
            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.sessionTitle}</TableCell>
                <TableCell>
                  <StatusBadge kind={STAGE_KIND[job.stage]} label={JOB_STAGE_LABELS[job.stage]} />
                  {job.stage === 'failed' && job.error ? (
                    <p className="mt-1 max-w-xs text-xs text-destructive">{job.error}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[job.speechProvider, job.summaryProvider].filter(Boolean).join(' → ') || '—'}
                </TableCell>
                <TableCell className="text-right">
                  {canRetry && job.stage === 'failed' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={retryingId === job.id}
                      onClick={() => void handleRetry(job.id)}
                    >
                      <RotateCcw aria-hidden />
                      Retry
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
