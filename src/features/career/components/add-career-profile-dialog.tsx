'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { captureCareerInterest } from '../actions/manage-career';

/** Opens a career profile for an existing participant by ID. */
export function AddCareerProfileDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [participantId, setParticipantId] = React.useState('');
  const [pending, setPending] = React.useState(false);

  const onSubmit = async () => {
    setPending(true);
    try {
      const outcome = await captureCareerInterest({
        participantId: participantId.trim(),
        jobCategories: '',
        preferredCountries: '',
        passportStatus: 'none',
        willingToRelocate: false,
        resumeStatus: 'none',
      });
      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      setOpen(false);
      router.push(`/career/${encodeURIComponent(participantId.trim())}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden />
          Add career profile
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add career profile</DialogTitle>
          <DialogDescription>
            Enter the Participant ID to start tracking their career interest and placement
            readiness.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="career-participant-id" required>
            Participant ID
          </Label>
          <Input
            id="career-participant-id"
            placeholder="TNX-2026-00042"
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!participantId.trim()} loading={pending}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
