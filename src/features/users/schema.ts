import { z } from 'zod';

import { STAFF_ROLES } from '@/types/common';

/** Domain schemas for user provisioning (Doc 20 §3, Doc 19). Framework-free. */

const E164 = /^\+[1-9]\d{7,14}$/;

export const provisionUserSchema = z
  .object({
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    displayName: z.string().trim().min(2, "Enter the staff member's full name").max(80),
    phone: z.string().trim().regex(E164, 'Enter phone in E.164 format, e.g. +919876543210'),
    role: z.enum(STAFF_ROLES, { errorMap: () => ({ message: 'Select a role' }) }),
    assignedBatchIds: z.array(z.string()).default([]),
  })
  .strict();

export type ProvisionUserInput = z.infer<typeof provisionUserSchema>;

export const setUserRoleSchema = z
  .object({
    uid: z.string().min(1),
    role: z.enum(STAFF_ROLES),
    assignedBatchIds: z.array(z.string()).default([]),
  })
  .strict();

export type SetUserRoleInput = z.infer<typeof setUserRoleSchema>;

export const setUserStatusSchema = z
  .object({
    uid: z.string().min(1),
    status: z.enum(['active', 'disabled']),
  })
  .strict();

export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>;

export interface StaffUser {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: (typeof STAFF_ROLES)[number];
  status: 'active' | 'disabled';
  assignedBatchIds: string[];
  lastLoginAt: string | null;
  mustChangePassword: boolean;
}
