'use client';

import { Building2, GraduationCap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { setCatalogueStatus } from '../actions/manage-programme';
import { formatPaise } from '../logic';
import type { Academy, CatalogueStatus, Programme } from '../schema';
import { AcademyDialog } from './academy-dialog';
import { ProgrammeDialog } from './programme-dialog';

/** S22 catalogue: academies and programmes (Doc 16). */
export function CatalogueView({
  academies,
  programmes,
  canManage,
}: {
  academies: Academy[];
  programmes: Programme[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const toggleStatus = async (
    entity: 'academy' | 'programme',
    id: string,
    current: CatalogueStatus,
  ) => {
    const status: CatalogueStatus = current === 'active' ? 'archived' : 'active';
    setPendingId(id);
    try {
      const outcome = await setCatalogueStatus({ entity, id, status });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(status === 'archived' ? 'Archived' : 'Restored');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Tabs defaultValue="programmes">
      <TabsList>
        <TabsTrigger value="programmes">Programmes</TabsTrigger>
        <TabsTrigger value="academies">Academies</TabsTrigger>
      </TabsList>

      <TabsContent value="programmes" className="space-y-4">
        {canManage ? (
          <div className="flex justify-end">
            <ProgrammeDialog academies={academies} />
          </div>
        ) : null}
        <Card>
          <CardContent className={programmes.length === 0 ? undefined : 'p-0'}>
            {programmes.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                headline="No programmes yet"
                explanation={
                  academies.length === 0
                    ? 'Create an academy first — every programme belongs to one.'
                    : 'Create a programme to define its certificate thresholds and default fee plan.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programme</TableHead>
                    <TableHead>Academy</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Intake</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>BR-03 gate</TableHead>
                    <TableHead>Default fee</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programmes.map((programme) => (
                    <TableRow key={programme.id}>
                      <TableCell>
                        <div className="font-medium">{programme.name}</div>
                        <code className="font-mono text-xs text-muted-foreground">
                          {programme.code}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm">{programme.academyName ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {programme.durationDays}d · {programme.sessionCount} sessions
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          kind={
                            programme.intakeStatus === 'open'
                              ? 'success'
                              : programme.intakeStatus === 'waitlist'
                                ? 'info'
                                : 'neutral'
                          }
                          label={
                            programme.intakeStatus === 'open'
                              ? 'Open'
                              : programme.intakeStatus === 'waitlist'
                                ? 'Waitlist'
                                : 'Closed'
                          }
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {programme.capacity ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {programme.certificateEnabled ? (
                          <>
                            {programme.certificateRules.minAttendancePct}% attendance ·{' '}
                            {programme.certificateRules.minAssessmentScore} score
                          </>
                        ) : (
                          <span className="italic">Certificates disabled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatPaise(programme.feePlanDefault.totalPaise)} {programme.currency}
                        {programme.feePlanDefault.installments.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {' '}
                            · {programme.feePlanDefault.installments.length} installments
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          kind={programme.status === 'active' ? 'success' : 'neutral'}
                          label={programme.status === 'active' ? 'Active' : 'Archived'}
                        />
                      </TableCell>
                      {canManage ? (
                        <TableCell className="space-x-2 text-right">
                          <ProgrammeDialog academies={academies} programme={programme} />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendingId === programme.id}
                            onClick={() =>
                              toggleStatus('programme', programme.id, programme.status)
                            }
                          >
                            {programme.status === 'active' ? 'Archive' : 'Restore'}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="academies" className="space-y-4">
        {canManage ? (
          <div className="flex justify-end">
            <AcademyDialog />
          </div>
        ) : null}
        <Card>
          <CardContent className={academies.length === 0 ? undefined : 'p-0'}>
            {academies.length === 0 ? (
              <EmptyState
                icon={Building2}
                headline="No academies yet"
                explanation="Academies group related programmes — create one to start building the catalogue."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Academy</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Programmes</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {academies.map((academy) => (
                    <TableRow key={academy.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {academy.displayOrder}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {academy.themeColor ? (
                            <span
                              aria-hidden
                              className="size-3 shrink-0 rounded-full border border-border"
                              style={{ backgroundColor: academy.themeColor }}
                            />
                          ) : null}
                          <div className="font-medium">{academy.name}</div>
                        </div>
                        {academy.description ? (
                          <div className="max-w-md truncate text-xs text-muted-foreground">
                            {academy.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <code className="font-mono text-xs text-muted-foreground">
                          {academy.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm">{academy.programmeCount}</TableCell>
                      <TableCell>
                        <StatusBadge
                          kind={academy.status === 'active' ? 'success' : 'neutral'}
                          label={academy.status === 'active' ? 'Active' : 'Archived'}
                        />
                      </TableCell>
                      {canManage ? (
                        <TableCell className="space-x-2 text-right">
                          <AcademyDialog academy={academy} />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendingId === academy.id}
                            onClick={() => toggleStatus('academy', academy.id, academy.status)}
                          >
                            {academy.status === 'active' ? 'Archive' : 'Restore'}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
