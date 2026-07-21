import { z } from 'zod';

/**
 * Batch scheduling and roster (Doc 03 §1.2/§1.5, Doc 14 §7, S23/S24).
 * `enrolledCount` is maintained transactionally with allocation — BR-04's
 * capacity check is `enrolledCount < capacity` inside that same transaction.
 */

export const BATCH_STATUSES = ['planned', 'running', 'completed', 'cancelled'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const SESSION_STATUSES = ['scheduled', 'held', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const batchSchema = z
  .object({
    programmeId: z.string().min(1, 'Select a programme'),
    code: z
      .string()
      .trim()
      .min(2, 'Batch code is required')
      .max(30)
      .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers, and hyphens only'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    capacity: z.number().int().positive('Capacity must be at least 1').max(500),
    trainerUid: z.string().trim().max(128).optional().or(z.literal('')),
    days: z.array(z.enum(WEEKDAYS)).min(1, 'Select at least one day'),
    startTime: z.string().regex(HHMM, 'Use 24-hour HH:MM'),
    endTime: z.string().regex(HHMM, 'Use 24-hour HH:MM'),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  })
  .refine((value) => value.endTime > value.startTime, {
    message: 'End time must be after the start time',
    path: ['endTime'],
  });

export type BatchInput = z.infer<typeof batchSchema>;

export const updateBatchSchema = z
  .object({
    batchId: z.string().min(1),
    programmeId: z.string().min(1, 'Select a programme'),
    code: z
      .string()
      .trim()
      .min(2, 'Batch code is required')
      .max(30)
      .regex(/^[A-Z0-9-]+$/, 'Use uppercase letters, numbers, and hyphens only'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    capacity: z.number().int().positive('Capacity must be at least 1').max(500),
    trainerUid: z.string().trim().max(128).optional().or(z.literal('')),
    days: z.array(z.enum(WEEKDAYS)).min(1, 'Select at least one day'),
    startTime: z.string().regex(HHMM, 'Use 24-hour HH:MM'),
    endTime: z.string().regex(HHMM, 'Use 24-hour HH:MM'),
  })
  .strict()
  .refine((value) => value.endDate >= value.startDate, {
    message: 'End date cannot be before the start date',
    path: ['endDate'],
  })
  .refine((value) => value.endTime > value.startTime, {
    message: 'End time must be after the start time',
    path: ['endTime'],
  });

export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;

export const setBatchStatusSchema = z
  .object({ batchId: z.string().min(1), status: z.enum(BATCH_STATUSES) })
  .strict();
export type SetBatchStatusInput = z.infer<typeof setBatchStatusSchema>;

export const allocateBatchSchema = z
  .object({
    batchId: z.string().min(1),
    participantId: z.string().min(1),
    enrolmentId: z.string().min(1),
  })
  .strict();
export type AllocateBatchInput = z.infer<typeof allocateBatchSchema>;

export const sessionSchema = z
  .object({
    batchId: z.string().min(1),
    date: z.string().min(1, 'Session date is required'),
    topic: z.string().trim().max(200).optional().or(z.literal('')),
    trainerUid: z.string().trim().max(128).optional().or(z.literal('')),
  })
  .strict();
export type SessionInput = z.infer<typeof sessionSchema>;

export const setSessionStatusSchema = z
  .object({
    batchId: z.string().min(1),
    sessionId: z.string().min(1),
    status: z.enum(SESSION_STATUSES),
  })
  .strict();
export type SetSessionStatusInput = z.infer<typeof setSessionStatusSchema>;

export const batchFiltersSchema = z.object({
  programmeId: z.string().trim().max(120).optional(),
  status: z.enum(BATCH_STATUSES).optional(),
  trainerUid: z.string().trim().max(128).optional(),
});
export type BatchFilters = z.infer<typeof batchFiltersSchema>;

/* ── Read models ───────────────────────────────────────────────────────── */

export interface BatchSchedule {
  days: Weekday[];
  startTime: string;
  endTime: string;
}

export interface Batch {
  id: string;
  programmeId: string;
  programmeName: string | null;
  academyId: string;
  code: string;
  startDate: string;
  endDate: string;
  capacity: number;
  /** Transactionally maintained with allocation — the BR-04 counter. */
  enrolledCount: number;
  trainerUid: string | null;
  trainerName: string | null;
  schedule: BatchSchedule;
  status: BatchStatus;
}

export interface BatchSession {
  id: string;
  date: string;
  topic: string | null;
  trainerUid: string | null;
  status: SessionStatus;
  heldAt: string | null;
}

export interface RosterEntry {
  participantId: string;
  participantName: string;
  phone: string;
  enrolmentId: string;
  enrolmentStatus: string;
}
