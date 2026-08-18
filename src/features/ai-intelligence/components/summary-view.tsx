import {
  CheckSquare,
  Eye,
  HelpCircle,
  Lightbulb,
  ListTodo,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';

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

/** Summary page — Executive Summary, Trainer Discussion, Student Participation,
 * Key Learning Points, Important Questions, Important Observations, Action
 * Items, Follow-up Required, Participant Insights. The five fields beyond
 * the original four are additive (schemaVersion 2) — a summary generated
 * before that change simply has empty values for them, rendered the same
 * as "nothing extracted" rather than as missing data. */
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

      {summary.trainerDiscussion || summary.studentParticipation ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.trainerDiscussion ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <UserCheck className="size-4 text-gold" aria-hidden />
                <CardTitle>Trainer discussion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{summary.trainerDiscussion}</p>
              </CardContent>
            </Card>
          ) : null}
          {summary.studentParticipation ? (
            <Card>
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Users className="size-4 text-gold" aria-hidden />
                <CardTitle>Student participation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{summary.studentParticipation}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

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
          icon={Eye}
          title="Important observations"
          items={summary.importantObservations}
          emptyText="None identified."
        />
        <ListCard
          icon={CheckSquare}
          title="Action items"
          items={summary.actionItems}
          emptyText="None identified."
        />
        <ListCard
          icon={ListTodo}
          title="Follow-up required"
          items={summary.followUpRequired}
          emptyText="None identified."
        />
        <ListCard
          icon={Users}
          title="Participant insights"
          items={summary.participantInsights}
          emptyText="No individually identifiable participant insights."
        />
      </div>
    </div>
  );
}
