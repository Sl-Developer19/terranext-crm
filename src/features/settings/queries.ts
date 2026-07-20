import 'server-only';

import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import type { GeneralSettings, IdFormatsSettings } from './schema';

function safeString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
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
};

const DEFAULTS_ID_FORMATS: Omit<IdFormatsSettings, 'updatedAt' | 'updatedBy'> = {
  schemaVersion: 1,
  branchId: 'HQ',
  participantPrefix: 'TNX',
  certificatePrefix: 'TNXC',
  receiptPrefix: 'RCP',
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
    updatedAt: toIso(d.updatedAt),
    updatedBy: safeString(d.updatedBy, 'system'),
  };
}
