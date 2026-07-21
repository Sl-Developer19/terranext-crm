'use client';

import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';

import { enterScores } from '../actions/manage-assessment';
import { deriveResult } from '../logic';
import type { Assessment, ScoreRow } from '../schema';

/**
 * S26 score entry. Pass/fail preview is computed client-side purely as
 * feedback while typing — the stored verdict is always the server's, derived
 * from the assessment's pass mark when the scores are saved.
 */
export function ScoreGrid({
  assessment,
  rows,
  canEnter,
}: {
  assessment: Assessment;
  rows: ScoreRow[];
  canEnter: boolean;
}) {
  const router = useRouter();
  const [scores, setScores] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.filter((row) => row.score !== null).map((row) => [row.participantId, String(row.score)]),
    ),
  );
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const payload = rows.map((row) => {
      const raw = scores[row.participantId];
      const trimmed = raw?.trim() ?? '';
      return {
        participantId: row.participantId,
        // An empty box clears the score rather than recording a zero.
        score: trimmed === '' ? null : Number(trimmed),
      };
    });

    const invalid = payload.find(
      (entry) =>
        entry.score !== null &&
        (!Number.isInteger(entry.score) || entry.score < 0 || entry.score > assessment.maxScore),
    );
    if (invalid) {
      toast.error(`Scores must be whole numbers between 0 and ${assessment.maxScore}.`);
      return;
    }

    setSaving(true);
    try {
      const outcome = await enterScores({ assessmentId: assessment.id, scores: payload });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Scores saved');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        headline="No participants on this batch roster"
        explanation="Allocate participants to the batch before entering scores."
      />
    );
  }

  const entered = Object.values(scores).filter((v) => v.trim() !== '').length;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>
          Scores
          <span className="ml-2 font-normal text-muted-foreground">
            {entered}/{rows.length} entered · pass mark {assessment.passScore}/{assessment.maxScore}
          </span>
        </CardTitle>
        {canEnter ? (
          <Button size="sm" onClick={save} loading={saving}>
            Save scores
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => {
          const raw = scores[row.participantId] ?? '';
          const numeric = raw.trim() === '' ? null : Number(raw);
          const preview =
            numeric !== null && Number.isFinite(numeric)
              ? deriveResult(numeric, assessment.passScore)
              : null;

          return (
            <div
              key={row.participantId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{row.participantName}</div>
                <div className="text-xs text-muted-foreground">{row.participantId}</div>
              </div>
              <div className="flex items-center gap-3">
                {preview ? (
                  <StatusBadge
                    kind={preview === 'pass' ? 'success' : 'danger'}
                    label={preview === 'pass' ? 'Pass' : 'Fail'}
                  />
                ) : null}
                <Input
                  type="number"
                  min={0}
                  max={assessment.maxScore}
                  className="w-24"
                  disabled={!canEnter || saving}
                  placeholder="—"
                  aria-label={`Score for ${row.participantName}`}
                  value={raw}
                  onChange={(event) =>
                    setScores((current) => ({
                      ...current,
                      [row.participantId]: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
