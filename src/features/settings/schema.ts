import { z } from 'zod';

/**
 * Settings feature schema (Doc 16 S53, Doc 03 §1.1 settings/* docs).
 * Framework-free. Zod schemas are the single source of truth (Doc 08 §3):
 * used identically in server actions (first line), form validation, and
 * mirrored as field constraints in Firestore rules (Doc 10 §3).
 */

export const generalSettingsSchema = z
  .object({
    orgName: z.string().trim().min(2, 'Organisation name is required').max(100),
    orgTagline: z.string().trim().max(200).default(''),
    address: z.string().trim().max(500).default(''),
    contactEmail: z
      .string()
      .trim()
      .email('Enter a valid email address')
      .or(z.literal(''))
      .default(''),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/, 'Enter phone in E.164 format, e.g. +919876543210')
      .or(z.literal(''))
      .default(''),
    website: z.string().trim().url('Enter a valid URL').or(z.literal('')).default(''),
  })
  .strict();

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

export const idFormatsSchema = z
  .object({
    /**
     * Prefix for auto-generated Participant IDs.
     * Final ID: {prefix}-{year}-{seq:05d}  e.g. TNX-2026-00042
     * Changing this after participants exist is a data migration (Doc 03 §7 open Q).
     */
    participantPrefix: z
      .string()
      .trim()
      .min(2, 'Prefix required')
      .max(10)
      .regex(/^[A-Z0-9]+$/, 'Uppercase letters and digits only'),
    /**
     * Prefix for certificate numbers.
     * Final ID: {prefix}-{year}-{seq:05d}  e.g. TNXC-2026-00107
     */
    certificatePrefix: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .regex(/^[A-Z0-9]+$/, 'Uppercase letters and digits only'),
    /**
     * Prefix for receipt numbers.
     * Final ID: {prefix}-FY{yy}-{seq:05d}  e.g. RCP-FY26-00001
     * Assumption: FY convention follows Indian fiscal year (Apr–Mar).
     * Flagged for owner sign-off (Doc 03 §7 open Q1).
     */
    receiptPrefix: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .regex(/^[A-Z0-9]+$/, 'Uppercase letters and digits only'),
  })
  .strict();

export type IdFormatsInput = z.infer<typeof idFormatsSchema>;

/** Shape of the `settings/general` document in Firestore. */
export interface GeneralSettings extends GeneralSettingsInput {
  schemaVersion: number;
  branchId: string;
  updatedAt: string;
  updatedBy: string;
}

/** Shape of the `settings/idFormats` document in Firestore. */
export interface IdFormatsSettings extends IdFormatsInput {
  schemaVersion: number;
  branchId: string;
  updatedAt: string;
  updatedBy: string;
}
