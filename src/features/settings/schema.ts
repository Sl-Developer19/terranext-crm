import { z } from 'zod';

/**
 * Settings feature schema (Doc 16 S53, Doc 03 §1.1 settings/* docs).
 * Framework-free. Zod schemas are the single source of truth (Doc 08 §3):
 * used identically in server actions (first line), form validation, and
 * mirrored as field constraints in Firestore rules (Doc 10 §3).
 */

const optionalUrl = z.string().trim().url('Enter a valid URL').or(z.literal('')).default('');

/**
 * GST/PAN are India-specific business tax identifiers (Doc 12 assumption,
 * same INR-specific posture as `money.ts`). Format-validated loosely (not a
 * checksum) since the authority is the government registration, not this
 * form. Never exposed on the public settings API (`api/settings/public`) —
 * these are internal business records, unlike contact/social info.
 */
const gstNumber = z
  .string()
  .trim()
  .regex(/^[0-9A-Z]{15}$/, 'Enter a 15-character GST number')
  .or(z.literal(''))
  .default('');

const panNumber = z
  .string()
  .trim()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a 10-character PAN, e.g. ABCDE1234F')
  .or(z.literal(''))
  .default('');

export const socialLinksSchema = z
  .object({
    facebook: optionalUrl,
    instagram: optionalUrl,
    linkedin: optionalUrl,
    twitter: optionalUrl,
    youtube: optionalUrl,
  })
  .strict();

export type SocialLinksInput = z.infer<typeof socialLinksSchema>;

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
    gstNumber,
    panNumber,
    googleMapsUrl: optionalUrl,
    socialLinks: socialLinksSchema.default({
      facebook: '',
      instagram: '',
      linkedin: '',
      twitter: '',
      youtube: '',
    }),
  })
  .strict();

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;

/**
 * Brand identity — colours and logo variants (Settings §4). Every consumer
 * that previously hardcoded `/brand/logo.png` or a literal hex colour reads
 * from here instead, falling back to the current static asset/colour only
 * when a field is left blank (Doc 04 §3 "never break the site/emails if
 * unconfigured" posture, same as `findDefaultLeadershipLevelSlug`'s null
 * fallback).
 */
const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a 6-digit hex colour, e.g. #C9A227')
  .or(z.literal(''))
  .default('');

export const brandingSettingsSchema = z
  .object({
    primaryColor: hexColor,
    secondaryColor: hexColor,
    accentColor: hexColor,
    logoUrl: optionalUrl,
    faviconUrl: optionalUrl,
    emailLogoUrl: optionalUrl,
    certificateLogoUrl: optionalUrl,
    qrLogoUrl: optionalUrl,
  })
  .strict();

export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>;

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
    /**
     * Prefix for Community Partner (TCGN) IDs.
     * Final ID: {prefix}-{seq:06d}  e.g. TCGN-000001
     */
    communityPartnerPrefix: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .regex(/^[A-Z0-9]+$/, 'Uppercase letters and digits only'),
    /**
     * Prefix for individual Growth Partner IDs.
     * Final ID: {prefix}-{seq:06d}  e.g. TGP-000001
     */
    growthPartnerPrefix: z
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

/** Shape of the `settings/branding` document in Firestore. */
export interface BrandingSettings extends BrandingSettingsInput {
  schemaVersion: number;
  branchId: string;
  updatedAt: string;
  updatedBy: string;
}
