'use client';

import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { setCollegeStatus } from '../actions/manage-college';
import { conversionPct, filterColleges, statusLabel, statusTone } from '../logic';
import { COLLEGE_STATUSES, type College, type CollegeStatus } from '../schema';
import { CollegeDialog } from './college-dialog';

const ALL = 'all';

/** S15 — college master with per-college lead stats (Doc 16). */
export function CollegesTable({
  colleges,
  canManage,
}: {
  colleges: College[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<CollegeStatus | typeof ALL>(ALL);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const visible = React.useMemo(
    () => filterColleges(colleges, { search, status: status === ALL ? undefined : status }),
    [colleges, search, status],
  );

  const onToggleStatus = async (college: College) => {
    setPendingId(college.id);
    try {
      const next: CollegeStatus = college.status === 'active' ? 'archived' : 'active';
      const outcome = await setCollegeStatus({ collegeId: college.id, status: next });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      toast.success(next === 'archived' ? 'College archived' : 'College restored');
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="college-search">Search</Label>
          <Input
            id="college-search"
            placeholder="Name, city or contact"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="college-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as CollegeStatus | typeof ALL)}
          >
            <SelectTrigger id="college-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {COLLEGE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {statusLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Building2}
          headline={colleges.length === 0 ? 'No colleges yet' : 'No colleges match'}
          explanation={
            colleges.length === 0
              ? 'Add the colleges that refer leads so their contribution can be tracked.'
              : 'Try clearing the search or widening the status filter.'
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>College</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Admitted</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((college) => {
              const rate = conversionPct(college);
              return (
                <TableRow key={college.id}>
                  <TableCell>
                    <Link
                      href={`/colleges/${college.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {college.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {college.leaderCount} campus leader{college.leaderCount === 1 ? '' : 's'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{college.city}</TableCell>
                  <TableCell className="text-sm">
                    {college.contactPerson ? (
                      <>
                        <div>{college.contactPerson}</div>
                        {college.contactPhone ? (
                          <div className="text-xs text-muted-foreground">
                            {college.contactPhone}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{college.leadCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{college.admittedCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rate === null ? <span className="text-muted-foreground">—</span> : `${rate}%`}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      kind={statusTone(college.status)}
                      label={statusLabel(college.status)}
                    />
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    {canManage ? (
                      <>
                        <CollegeDialog college={college} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendingId === college.id}
                          onClick={() => onToggleStatus(college)}
                        >
                          {college.status === 'active' ? 'Archive' : 'Restore'}
                        </Button>
                      </>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
