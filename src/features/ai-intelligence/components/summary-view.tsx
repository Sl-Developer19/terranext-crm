import { CheckSquare, HelpCircle, Lightbulb, Sparkles } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

import type { AiSummary } from '../schema';

function ListCard({
  icon: Icon,
  title,
  items,
  emptyText,
}: {
  icon: typeof Lightbulb;
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Icon className="size-4 text-gold" aria-hidden />
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={index} className="flex gap-2 text-sm leading-relaxed">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-gold" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Summary page — Executive Summary, Key Learning Points, Important Questions, Action Items. */
export function SummaryView({ summary }: { summary: AiSummary | null }) {
  if (!summary) {
    return (
      <EmptyState
        icon={Sparkles}
        headline="No AI summary yet"
        explanation="The executive summary, key points, questions, and action items appear automatically once AI analysis finishes."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Sparkles className="size-4 text-gold" aria-hidden />
          <CardTitle>Executive summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            {summary.executiveSummary || 'No summary generated.'}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <ListCard
          icon={Lightbulb}
          title="Key learning points"
          items={summary.keyLearningPoints}
          emptyText="None identified."
        />
        <ListCard
          icon={HelpCircle}
          title="Important questions"
          items={summary.importantQuestions}
          emptyText="None identified."
        />
        <ListCard
          icon={CheckSquare}
          title="Action items"
          items={summary.actionItems}
          emptyText="None identified."
        />
      </div>
    </div>
  );
}
