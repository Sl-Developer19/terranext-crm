'use server';

import { FieldValue } from 'firebase-admin/firestore';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { can } from '@/lib/rbac/permissions';
import {
  internalError,
  ok,
  permissionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import {
  generalSettingsSchema,
  idFormatsSchema,
  type GeneralSettingsInput,
  type IdFormatsInput,
} from '../schema';

/**
 * Updates `settings/general` (Doc 16 S53, Doc 03 §1.1).
 * Only system_admin may configure settings (Doc 04 §3).
 * Every save is audited (BR-06, ADR-007).
 */
export async function updateGeneralSettings(input: GeneralSettingsInput): Promise<Result<void>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'settings:configure')) return permissionError();

  const parsed = generalSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }

  const db = adminDb();
  const ref = db.collection('settings').doc('general');

  try {
    const existing = await ref.get();
    const before = existing.exists ? existing.data() : null;

    await ref.set(
      {
        schemaVersion: 1,
        branchId: session.branchId,
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      },
      { merge: true },
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'settings',
      entityId: 'general',
      entityPath: 'settings/general',
      changes: {
        orgName: { before: before?.orgName ?? null, after: parsed.data.orgName },
      },
      context: { feature: 'settings' },
    });

    return ok(undefined);
  } catch {
    return internalError('Could not save settings. Please try again.');
  }
}

/**
 * Updates `settings/idFormats` (Doc 16 S53).
 * ASSUMPTION: FY convention is Indian fiscal year (Apr–Mar), receipt format
 * is `{prefix}-FY{yy}-{seq}`. Flagged for owner sign-off (Doc 03 §7 open Q1).
 */
export async function updateIdFormats(input: IdFormatsInput): Promise<Result<void>> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'settings:configure')) return permissionError();

  const parsed = idFormatsSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    return validationError(fields);
  }

  const db = adminDb();
  const ref = db.collection('settings').doc('idFormats');

  try {
    const existing = await ref.get();
    const before = existing.exists ? existing.data() : null;

    await ref.set(
      {
        schemaVersion: 1,
        branchId: session.branchId,
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      },
      { merge: true },
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'settings',
      entityId: 'idFormats',
      entityPath: 'settings/idFormats',
      changes: {
        participantPrefix: {
          before: before?.participantPrefix ?? null,
          after: parsed.data.participantPrefix,
        },
        certificatePrefix: {
          before: before?.certificatePrefix ?? null,
          after: parsed.data.certificatePrefix,
        },
        receiptPrefix: {
          before: before?.receiptPrefix ?? null,
          after: parsed.data.receiptPrefix,
        },
      },
      context: { feature: 'settings' },
    });

    return ok(undefined);
  } catch {
    return internalError('Could not save ID formats. Please try again.');
  }
}
