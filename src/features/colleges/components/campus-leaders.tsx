'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { addCampusLeader, setLeaderActive } from '../actions/manage-college';
import { campusLeaderSchema, type CampusLeader, type CampusLeaderInput } from '../schema';

function AddLeaderDialog({ collegeId }: { collegeId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CampusLeaderInput>({
    resolver: zodResolver(campusLeaderSchema),
    defaultValues: { collegeId, name: '', phone: '', participantId: '' },
  });

  const onSubmit = async (values: CampusLeaderInput) => {
    const outcome = await addCampusLeader(values);
    if (!outcome.ok) {
      if (outcome.error.code === 'validation' && outcome.error.fields) {
        for (const [key, message] of Object.entries(outcome.error.fields)) {
          form.setError(key as keyof CampusLeaderInput, { message });
        }
      } else {
        toast.error(outcome.error.message);
      }
      return;
    }
    toast.success('Campus leader added');
    setOpen(false);
    form.reset({ collegeId, name: '', phone: '', participantId: '' });
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden />
          Add leader
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add campus leader</DialogTitle>
          <DialogDescription>
            Campus leaders are the named contacts who refer students. They may themselves be
            participants — linking their ID keeps the two records connected.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leader-name" required>
              Name
            </Label>
            <Input id="leader-name" autoFocus {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="leader-phone" required>
              Phone
            </Label>
            <Input id="leader-phone" placeholder="+919876543210" {...form.register('phone')} />
            {form.formState.errors.phone ? (
              <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="leader-participant">Participant ID (optional)</Label>
            <Input
              id="leader-participant"
              placeholder="TNX-2026-00042"
              {...form.register('participantId')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Add leader
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** S15 campus leaders sub-table (Doc 16). */
export function CampusLeaders({
  collegeId,
  leaders,
  canManage,
}: {
  collegeId: string;
  leaders: CampusLeader[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const onToggle = async (leader: CampusLeader) => {
    setPendingId(leader.id);
    try {
      const outcome = await setLeaderActive({
        collegeId,
        leaderId: leader.id,
        active: !leader.active,
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex justify-end">
          <AddLeaderDialog collegeId={collegeId} />
        </div>
      ) : null}

      {leaders.length === 0 ? (
        <EmptyState
          icon={Users}
          headline="No campus leaders"
          explanation="Add the students or staff who refer leads from this college."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaders.map((leader) => (
              <TableRow key={leader.id}>
                <TableCell className="font-medium">{leader.name}</TableCell>
                <TableCell className="text-sm">{leader.phone}</TableCell>
                <TableCell className="text-sm">
                  {leader.participantId ? (
                    <Link
                      href={`/participants/${leader.participantId}`}
                      className="underline underline-offset-2"
                    >
                      {leader.participantId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    kind={leader.active ? 'success' : 'neutral'}
                    label={leader.active ? 'Active' : 'Inactive'}
                  />
                </TableCell>
                {canManage ? (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === leader.id}
                      onClick={() => onToggle(leader)}
                    >
                      {leader.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
