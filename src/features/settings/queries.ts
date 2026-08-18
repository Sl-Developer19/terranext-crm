import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type {
  BrandingSettings,
  GeneralSettings,
  IdFormatsSettings,
  SocialLinksInput,
} from './schema';

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

const EMPTY_SOCIAL_LINKS: SocialLinksInput = {
  facebook: '',
  instagram: '',
  linkedin: '',
  twitter: '',
  youtube: '',
};

function safeSocialLinks(v: unknown): SocialLinksInput {
  if (typeof v !== 'object' || v === null) return EMPTY_SOCIAL_LINKS;
  const d = v as Record<string, unknown>;
  return {
    facebook: safeString(d.facebook),
    instagram: safeString(d.instagram),
    linkedin: safeString(d.linkedin),
    twitter: safeString(d.twitter),
    youtube: safeString(d.youtube),
  };
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

const DEFAULTS_GENERAL: Omit<GeneralSettings, 'updatedAt' | 'updatedBy'> = {
  schemaVersion: 1,
  branchId: 'HQ',
  orgName: 'TerraNext Global Ventures',
  orgTagline: '',
  address: '',
  contactEmail: '',
  contactPhone: '',
  website: '',
  gstNumber: '',
  panNumber: '',
  googleMapsUrl: '',
  socialLinks: EMPTY_SOCIAL_LINKS,
};

const DEFAULTS_BRANDING: Omit<BrandingSettings, 'updatedAt' | 'updatedBy'> = {
  schemaVersion: 1,
  branchId: 'HQ',
  primaryColor: '',
  secondaryColor: '',
  accentColor: '',
  logoUrl: '',
  faviconUrl: '',
  emailLogoUrl: '',
  certificateLogoUrl: '',
  qrLogoUrl: '',
};

const DEFAULTS_ID_FORMATS: Omit<IdFormatsSettings, 'updatedAt' | 'updatedBy'> = {
  schemaVersion: 1,
  branchId: 'HQ',
  participantPrefix: 'TNX',
  certificatePrefix: 'TNXC',
  receiptPrefix: 'RCP',
  communityPartnerPrefix: 'TCGN',
  growthPartnerPrefix: 'TGP',
};

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const doc = await adminDb().collection('settings').doc('general').get();
  if (!doc.exists) {
    return {
      ...DEFAULTS_GENERAL,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }
  const d = doc.data() ?? {};
  return {
    schemaVersion: typeof d.schemaVersion === 'number' ? d.schemaVersion : 1,
    branchId: safeString(d.branchId, 'HQ'),
    orgName: safeString(d.orgName, DEFAULTS_GENERAL.orgName),
    orgTagline: safeString(d.orgTagline),
    address: safeString(d.address),
    contactEmail: safeString(d.contactEmail),
    contactPhone: safeString(d.contactPhone),
    website: safeString(d.website),
    gstNumber: safeString(d.gstNumber),
    panNumber: safeString(d.panNumber),
    googleMapsUrl: safeString(d.googleMapsUrl),
    socialLinks: safeSocialLinks(d.socialLinks),
    updatedAt: toIso(d.updatedAt),
    updatedBy: safeString(d.updatedBy, 'system'),
  };
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const doc = await adminDb().collection('settings').doc('branding').get();
  if (!doc.exists) {
    return {
      ...DEFAULTS_BRANDING,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }
  const d = doc.data() ?? {};
  return {
    schemaVersion: typeof d.schemaVersion === 'number' ? d.schemaVersion : 1,
    branchId: safeString(d.branchId, 'HQ'),
    primaryColor: safeString(d.primaryColor),
    secondaryColor: safeString(d.secondaryColor),
    accentColor: safeString(d.accentColor),
    logoUrl: safeString(d.logoUrl),
    faviconUrl: safeString(d.faviconUrl),
    emailLogoUrl: safeString(d.emailLogoUrl),
    certificateLogoUrl: safeString(d.certificateLogoUrl),
    qrLogoUrl: safeString(d.qrLogoUrl),
    updatedAt: toIso(d.updatedAt),
    updatedBy: safeString(d.updatedBy, 'system'),
  };
}

export async function getIdFormats(): Promise<IdFormatsSettings> {
  const doc = await adminDb().collection('settings').doc('idFormats').get();
  if (!doc.exists) {
    return {
      ...DEFAULTS_ID_FORMATS,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
  }
  const d = doc.data() ?? {};
  return {
    schemaVersion: typeof d.schemaVersion === 'number' ? d.schemaVersion : 1,
    branchId: safeString(d.branchId, 'HQ'),
    participantPrefix: safeString(d.participantPrefix, DEFAULTS_ID_FORMATS.participantPrefix),
    certificatePrefix: safeString(d.certificatePrefix, DEFAULTS_ID_FORMATS.certificatePrefix),
    receiptPrefix: safeString(d.receiptPrefix, DEFAULTS_ID_FORMATS.receiptPrefix),
    communityPartnerPrefix: safeString(
      d.communityPartnerPrefix,
      DEFAULTS_ID_FORMATS.communityPartnerPrefix,
    ),
    growthPartnerPrefix: safeString(d.growthPartnerPrefix, DEFAULTS_ID_FORMATS.growthPartnerPrefix),
    updatedAt: toIso(d.updatedAt),
    updatedBy: safeString(d.updatedBy, 'system'),
  };
}
