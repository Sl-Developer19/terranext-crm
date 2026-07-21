import { z } from 'zod';

/**
 * Placements pipeline (Doc 03 §1.6, Doc 14 §16, BR-08, BR-09, S31).
 * Doc ID = generated; a participant can have more than one placement record
 * over time (re-placement after a drop), unlike the 1:1 career profile.
 */

export const PLACEMENT_STATUSES = [
  'under_review',
  'shortlisted',
  'interview',
  'offer',
  'placed',
  'dropped',
] as const;
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number];

/** Forward order of the active pipeline — `dropped` is a side-exit, not a stage. */
export const PLACEMENT_STAGE_ORDER = [
  'under_review',
  'shortlisted',
  'interview',
  'offer',
  'placed',
] as const satisfies readonly PlacementStatus[];

export const createPlacementSchema = z
  .object({
    participantId: z.string().min(1),
    employerId: z.string().min(1, 'Select an employer'),
    jobCategory: z.string().trim().min(2, 'Job category is required').max(120),
    country: z.string().trim().min(2, 'Country is required').max(80),
    thirdPartyNotes: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .strict();
export type CreatePlacementInput = z.infer<typeof createPlacementSchema>;

export const advancePlacementSchema = z
  .object({
    placementId: z.string().min(1),
    status: z.enum(PLACEMENT_STATUSES),
    note: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .strict()
  .refine((v) => v.status !== 'dropped' || (v.note ?? '').trim().length >= 5, {
    // Dropping a candidate ends the pipeline for them — the SOP requires a reason.
    message: 'A reason of at least 5 characters is required to drop a placement',
    path: ['note'],
  });
export type AdvancePlacementInput = z.infer<typeof advancePlacementSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface PlacementStatusEvent {
  status: PlacementStatus;
  at: string;
  byUid: string;
  byName: string | null;
  note: string | null;
}

export interface Placement {
  id: string;
  participantId: string;
  participantName: string;
  employerId: string;
  employerName: string;
  jobCategory: string;
  country: string;
  status: PlacementStatus;
  statusHistory: PlacementStatusEvent[];
  feeDisclosure: { terranextFeePaise: 0; thirdPartyNotes: string | null };
  updatedAt: string;
}
