'use client';

import { format } from 'date-fns';
import { GraduationCap, MessageSquareText, Plus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

import { addParent, linkParticipant } from '../actions/manage-family';
import { convertParentToLead, logParentSession } from '../actions/parent-counselling';
import { conversionBlocker } from '../logic';
import {
  PARENT_RELATIONS,
  PARENT_SESSION_MODES,
  PARENT_SESSION_OUTCOMES,
  type Family,
  type FamilyProgrammeHistoryRow,
  type Parent,
  type ParentRelation,
  type ParentSession,
} from '../schema';
import { CONVERSION_BADGE, CONVERSION_LABELS } from './families-table';
import { RELATION_LABELS } from './create-family-dialog';

const MODE_LABELS = { in_person: 'In person', phone: 'Phone', video: 'Video' } as const;
const OUTCOME_LABELS = {
  recommended: 'Recommended',
  follow_up: 'Follow-up',
  not_interested: 'Not interested',
} as const;

interface SessionFormValues {
  parentId: string;
  heldAt: string;
  mode: (typeof PARENT_SESSION_MODES)[number];
  notes: string;
  outcome: (typeof PARENT_SESSION_OUTCOMES)[number];
  recommendedProgrammeId: string;
  nextFollowUpAt: string;
}

interface ParentFormValues {
  name: string;
  phone: string;
  email: string;
  relation: ParentRelation;
  occupation: string;
}

/** Family workspace: parents, counselling history, conversion, programme history. */
export function FamilyDetailView({
  family,
  parents,
  sessions,
  history,
  canUpdate,
}: {
  family: Family;
  parents: Parent[];
  sessions: ParentSession[];
  history: FamilyProgrammeHistoryRow[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [parentOpen, setParentOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkId, setLinkId] = React.useState('');
  const [converting, setConverting] = React.useState<string | null>(null);

  const sessionForm = useForm<SessionFormValues>({
    defaultValues: {
      parentId: parents[0]?.id ?? '',
      heldAt: new Date().toISOString().slice(0, 10),
      mode: 'phone',
      notes: '',
      outcome: 'follow_up',
      recommendedProgrammeId: '',
      nextFollowUpAt: '',
    },
  });
  const parentForm = useForm<ParentFormValues>({
    defaultValues: { name: '', phone: '', email: '', relation: 'father', occupation: '' },
  });

  const onLogSession = async (values: SessionFormValues) => {
    const outcome = await logParentSession({
      familyId: family.id,
      parentId: values.parentId,
      heldAt: values.heldAt,
      mode: values.mode,
      notes: values.notes,
      outcome: values.outcome,
      recommendedProgrammeId: values.recommendedProgrammeId,
      nextFollowUpAt: values.nextFollowUpAt,
    });
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          sessionForm.setError(key as keyof SessionFormValues, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Counselling session recorded');
    sessionForm.reset({ ...sessionForm.getValues(), notes: '', recommendedProgrammeId: '' });
    router.refresh();
  };

  const onAddParent = async (values: ParentFormValues) => {
    const outcome = await addParent({ familyId: family.id, ...values });
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    toast.success('Parent added');
    setParentOpen(false);
    parentForm.reset();
    router.refresh();
  };

  const onLink = async () => {
    const outcome = await linkParticipant({ familyId: family.id, participantId: linkId.trim() });
    if (!outcome.ok) {
      toast.error(outcome.error.message);
      return;
    }
    toast.success('Participant linked to this family');
    setLinkOpen(false);
    setLinkId('');
    router.refresh();
  };

  const onConvert = async (parent: Parent) => {
    setConverting(parent.id);
    try {
      const outcome = await convertParentToLead({ familyId: family.id, parentId: parent.id });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success('Parent converted to a lead');
      router.refresh();
    } finally {
      setConverting(null);
    }
  };

  return (
    <Tabs defaultValue="parents">
      <TabsList>
        <TabsTrigger value="parents">Parents</TabsTrigger>
        <TabsTrigger value="counselling">Counselling</TabsTrigger>
        <TabsTrigger value="history">Programme history</TabsTrigger>
        <TabsTrigger value="details">Family details</TabsTrigger>
      </TabsList>

      <TabsContent value="parents">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Parents &amp; guardians</CardTitle>
            {canUpdate ? (
              <Dialog open={parentOpen} onOpenChange={setParentOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus aria-hidden />
                    Add parent
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add parent or guardian</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={parentForm.handleSubmit(onAddParent)}
                    noValidate
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="parent-name" required>
                        Name
                      </Label>
                      <Input id="parent-name" {...parentForm.register('name')} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="parent-phone" required>
                          Phone
                        </Label>
                        <Input
                          id="parent-phone"
                          placeholder="+919876543210"
                          {...parentForm.register('phone')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="parent-relation" required>
                          Relation
                        </Label>
                        <Select
                          defaultValue="father"
                          onValueChange={(v) =>
                            parentForm.setValue('relation', v as ParentRelation)
                          }
                        >
                          <SelectTrigger id="parent-relation">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PARENT_RELATIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {RELATION_LABELS[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="parent-email">Email</Label>
                        <Input id="parent-email" type="email" {...parentForm.register('email')} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="parent-occupation">Occupation</Label>
                        <Input id="parent-occupation" {...parentForm.register('occupation')} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setParentOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" loading={parentForm.formState.isSubmitting}>
                        Add parent
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Relation</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Conversion</TableHead>
                  {canUpdate ? <TableHead className="text-right">Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parents.map((parent) => {
                  const parentSessions = sessions.filter((s) => s.parentId === parent.id);
                  const blocker = conversionBlocker(parentSessions);
                  return (
                    <TableRow key={parent.id}>
                      <TableCell className="font-medium">{parent.name}</TableCell>
                      <TableCell className="text-sm">{RELATION_LABELS[parent.relation]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {parent.phone}
                        {parent.email ? <div className="text-xs">{parent.email}</div> : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          kind={CONVERSION_BADGE[parent.conversionStatus]}
                          label={CONVERSION_LABELS[parent.conversionStatus]}
                        />
                        {parent.leadId ? (
                          <Link
                            href={`/leads/${parent.leadId}`}
                            className="block text-xs hover:underline"
                          >
                            View lead
                          </Link>
                        ) : null}
                      </TableCell>
                      {canUpdate ? (
                        <TableCell className="text-right">
                          {parent.leadId ? null : (
                            <div className="flex flex-col items-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={blocker !== null || converting === parent.id}
                                onClick={() => onConvert(parent)}
                              >
                                Convert to lead
                              </Button>
                              {blocker ? (
                                <span className="max-w-[16rem] text-right text-xs text-muted-foreground">
                                  {blocker}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="counselling">
        <Card>
          <CardHeader>
            <CardTitle>Parent counselling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {canUpdate && parents.length > 0 ? (
              <form
                onSubmit={sessionForm.handleSubmit(onLogSession)}
                noValidate
                className="space-y-3 rounded-md border p-4"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="session-parent" required>
                      Parent
                    </Label>
                    <Select
                      {...(parents[0]?.id ? { defaultValue: parents[0].id } : {})}
                      onValueChange={(v) => sessionForm.setValue('parentId', v)}
                    >
                      <SelectTrigger id="session-parent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parents.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-date" required>
                      Held on
                    </Label>
                    <Input id="session-date" type="date" {...sessionForm.register('heldAt')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-mode" required>
                      Mode
                    </Label>
                    <Select
                      defaultValue="phone"
                      onValueChange={(v) =>
                        sessionForm.setValue('mode', v as SessionFormValues['mode'])
                      }
                    >
                      <SelectTrigger id="session-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARENT_SESSION_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {MODE_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session-notes" required>
                    Notes
                  </Label>
                  <Textarea id="session-notes" {...sessionForm.register('notes')} />
                  {sessionForm.formState.errors.notes ? (
                    <p className="text-xs text-destructive">
                      {sessionForm.formState.errors.notes.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="session-outcome" required>
                      Outcome
                    </Label>
                    <Select
                      defaultValue="follow_up"
                      onValueChange={(v) =>
                        sessionForm.setValue('outcome', v as SessionFormValues['outcome'])
                      }
                    >
                      <SelectTrigger id="session-outcome">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARENT_SESSION_OUTCOMES.map((o) => (
                          <SelectItem key={o} value={o}>
                            {OUTCOME_LABELS[o]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-programme">Programme recommended</Label>
                    <Input
                      id="session-programme"
                      placeholder="Required when recommending"
                      {...sessionForm.register('recommendedProgrammeId')}
                    />
                    {sessionForm.formState.errors.recommendedProgrammeId ? (
                      <p className="text-xs text-destructive">
                        {sessionForm.formState.errors.recommendedProgrammeId.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-followup">Next follow-up</Label>
                    <Input
                      id="session-followup"
                      type="date"
                      {...sessionForm.register('nextFollowUpAt')}
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" loading={sessionForm.formState.isSubmitting}>
                  Record session
                </Button>
              </form>
            ) : null}

            {sessions.length === 0 ? (
              <EmptyState
                icon={MessageSquareText}
                headline="No counselling sessions yet"
                explanation="A parent can only be converted to a lead after a session recommends a programme."
              />
            ) : (
              <ol className="space-y-4">
                {sessions.map((session) => (
                  <li key={session.id} className="border-l-2 pl-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {session.parentName ?? 'Parent'} · {MODE_LABELS[session.mode]}
                      </span>
                      <StatusBadge
                        kind={
                          session.outcome === 'recommended'
                            ? 'success'
                            : session.outcome === 'follow_up'
                              ? 'progress'
                              : 'neutral'
                        }
                        label={OUTCOME_LABELS[session.outcome]}
                      />
                    </div>
                    <p className="mt-1 text-sm">{session.notes}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {session.heldAt ? format(new Date(session.heldAt), 'PP') : ''}
                      {session.recommendedProgrammeId
                        ? ` · recommended ${session.recommendedProgrammeId}`
                        : ''}
                      {session.counsellorName ? ` · by ${session.counsellorName}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Family programme history</CardTitle>
            {canUpdate ? (
              <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus aria-hidden />
                    Link participant
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link a participant to this family</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="link-participant" required>
                      Participant ID
                    </Label>
                    <Input
                      id="link-participant"
                      placeholder="TNX-2026-00042"
                      value={linkId}
                      onChange={(e) => setLinkId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The participant record is linked, never copied — it stays the single lifetime
                      record.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={onLink} disabled={!linkId.trim()}>
                      Link
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </CardHeader>
          <CardContent className={history.length === 0 ? undefined : 'p-0'}>
            {history.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                headline="No programme history yet"
                explanation="Link participants to this family to see everything the household has done with the academy."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead>Certificate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={`${row.participantId}-${row.programmeId}-${row.enrolledAt}`}>
                      <TableCell>
                        <Link
                          href={`/participants/${encodeURIComponent(row.participantId)}`}
                          className="font-medium hover:underline"
                        >
                          {row.participantName}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.memberKind === 'parent' ? 'parent' : 'participant'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.programmeName ?? row.programmeId}
                      </TableCell>
                      <TableCell className="text-sm">{row.batchId ?? '—'}</TableCell>
                      <TableCell className="text-sm capitalize">
                        {row.status.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.enrolledAt ? format(new Date(row.enrolledAt), 'PP') : '—'}
                      </TableCell>
                      <TableCell>
                        {row.certificateId ? (
                          <code className="font-mono text-xs">{row.certificateId}</code>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="details">
        <Card>
          <CardHeader>
            <CardTitle>Family details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Primary contact</div>
              <div>
                {family.primaryContactName} ({RELATION_LABELS[family.relation]})
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div>{family.primaryContactPhone}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div>{family.primaryContactEmail ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Address</div>
              <div>{family.address ?? '—'}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground">Notes</div>
              <div>{family.notes ?? '—'}</div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
