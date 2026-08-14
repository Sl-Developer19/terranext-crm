import 'server-only';

import {
  Timestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';

import { defaultSignatories, defaultTemplateFields, validateForActivation } from './logic';
import type {
  ArtworkMeta,
  CertificateTemplate,
  Signatories,
  SignatureSlot,
  TemplateFields,
  TemplateVersion,
  TemplateVersionStatus,
} from './schema';

/** Certificate Template Engine data access. */

const TEMPLATES = 'certificateTemplates';
const VERSIONS = 'versions';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function toArtwork(value: unknown): ArtworkMeta | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const storagePath = asStringOrNull(data.storagePath);
  if (!storagePath) return null;
  return {
    storagePath,
    mimeType: (asString(data.mimeType) || 'image/png') as ArtworkMeta['mimeType'],
    widthPx: asNumber(data.widthPx),
    heightPx: asNumber(data.heightPx),
    sizeBytes: asNumber(data.sizeBytes),
  };
}

function toTemplate(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  academyName: string | null,
  programmeName: string | null,
): CertificateTemplate {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    name: asString(data.name),
    description: asString(data.description),
    academyId: asStringOrNull(data.academyId),
    academyName,
    programmeId: asStringOrNull(data.programmeId),
    programmeName,
    activeVersionId: asStringOrNull(data.activeVersionId),
    activeVersionNumber:
      data.activeVersionNumber != null ? asNumber(data.activeVersionNumber) : null,
    latestVersionNumber: asNumber(data.latestVersionNumber) || 1,
    createdAt: toIso(data.createdAt) ?? '',
    createdBy: asString(data.createdBy),
    updatedAt: toIso(data.updatedAt) ?? '',
    updatedBy: asString(data.updatedBy),
  };
}

function toVersion(
  doc: DocumentSnapshot | QueryDocumentSnapshot,
  templateId: string,
): TemplateVersion {
  const data = doc.data() ?? {};
  const signatoriesData = (data.signatories ?? {}) as Record<string, unknown>;
  const toSig = (raw: unknown) => {
    const s = (raw ?? {}) as Record<string, unknown>;
    return {
      name: asString(s.name),
      designation: asString(s.designation),
      storagePath: asStringOrNull(s.storagePath),
    };
  };

  return {
    id: doc.id,
    templateId,
    versionNumber: asNumber(data.versionNumber) || 1,
    status: (asString(data.status) || 'draft') as TemplateVersionStatus,
    artwork: toArtwork(data.artwork),
    fields: (data.fields ?? defaultTemplateFields()) as TemplateFields,
    signatories: {
      signature1: toSig(signatoriesData.signature1),
      signature2: toSig(signatoriesData.signature2),
    } satisfies Signatories,
    submittedAt: toIso(data.submittedAt),
    submittedBy: asStringOrNull(data.submittedBy),
    approvedAt: toIso(data.approvedAt),
    approvedBy: asStringOrNull(data.approvedBy),
    activatedAt: toIso(data.activatedAt),
    activatedBy: asStringOrNull(data.activatedBy),
    archivedAt: toIso(data.archivedAt),
    archivedBy: asStringOrNull(data.archivedBy),
    createdAt: toIso(data.createdAt) ?? '',
    createdBy: asString(data.createdBy),
    updatedAt: toIso(data.updatedAt) ?? '',
    updatedBy: asString(data.updatedBy),
  };
}

async function nameMaps(academyIds: Iterable<string>, programmeIds: Iterable<string>) {
  const db = adminDb();
  const uniqueAcademies = [...new Set(academyIds)].filter((id) => id.length > 0);
  const uniqueProgrammes = [...new Set(programmeIds)].filter((id) => id.length > 0);

  const [academyDocs, programmeDocs] = await Promise.all([
    Promise.all(uniqueAcademies.map((id) => db.collection('academies').doc(id).get())),
    Promise.all(uniqueProgrammes.map((id) => db.collection('programmes').doc(id).get())),
  ]);

  return {
    academies: new Map(academyDocs.map((d) => [d.id, asString(d.get('name'))])),
    programmes: new Map(programmeDocs.map((d) => [d.id, asString(d.get('name'))])),
  };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export async function findTemplates(): Promise<CertificateTemplate[]> {
  const snap = await adminDb().collection(TEMPLATES).orderBy('createdAt', 'desc').limit(200).get();
  const names = await nameMaps(
    snap.docs.map((d) => asString(d.get('academyId'))),
    snap.docs.map((d) => asString(d.get('programmeId'))),
  );
  return snap.docs.map((doc) =>
    toTemplate(
      doc,
      names.academies.get(asString(doc.get('academyId'))) ?? null,
      names.programmes.get(asString(doc.get('programmeId'))) ?? null,
    ),
  );
}

export async function findTemplateById(templateId: string): Promise<CertificateTemplate | null> {
  const snap = await adminDb().collection(TEMPLATES).doc(templateId).get();
  if (!snap.exists) return null;
  const names = await nameMaps(
    [asString(snap.get('academyId'))],
    [asString(snap.get('programmeId'))],
  );
  return toTemplate(
    snap,
    names.academies.get(asString(snap.get('academyId'))) ?? null,
    names.programmes.get(asString(snap.get('programmeId'))) ?? null,
  );
}

export async function findVersions(templateId: string): Promise<TemplateVersion[]> {
  const snap = await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .collection(VERSIONS)
    .orderBy('versionNumber', 'desc')
    .get();
  return snap.docs.map((doc) => toVersion(doc, templateId));
}

export async function findVersion(
  templateId: string,
  versionId: string,
): Promise<TemplateVersion | null> {
  const snap = await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .collection(VERSIONS)
    .doc(versionId)
    .get();
  if (!snap.exists) return null;
  return toVersion(snap, templateId);
}

/**
 * Resolves the certificate template to use at issuance (Doc: template
 * selection). Programme-level assignment wins; academy-level is a fallback
 * only when the programme has no active template of its own. Never returns
 * a template whose selected version isn't ACTIVE — a draft/review/approved
 * version must never be reachable from here.
 */
export async function findActiveTemplateForAssignment(
  programmeId: string,
  academyId: string,
): Promise<{ templateId: string; versionId: string; versionNumber: number } | null> {
  const db = adminDb();

  const programmeMatches = await db
    .collection(TEMPLATES)
    .where('programmeId', '==', programmeId)
    .limit(10)
    .get();
  const activeProgrammeTemplate = programmeMatches.docs.find((d) =>
    asStringOrNull(d.get('activeVersionId')),
  );
  if (activeProgrammeTemplate) {
    return {
      templateId: activeProgrammeTemplate.id,
      versionId: asString(activeProgrammeTemplate.get('activeVersionId')),
      versionNumber: asNumber(activeProgrammeTemplate.get('activeVersionNumber')),
    };
  }

  const academyMatches = await db
    .collection(TEMPLATES)
    .where('academyId', '==', academyId)
    .where('programmeId', '==', null)
    .limit(10)
    .get();
  const activeAcademyTemplate = academyMatches.docs.find((d) =>
    asStringOrNull(d.get('activeVersionId')),
  );
  if (activeAcademyTemplate) {
    return {
      templateId: activeAcademyTemplate.id,
      versionId: asString(activeAcademyTemplate.get('activeVersionId')),
      versionNumber: asNumber(activeAcademyTemplate.get('activeVersionNumber')),
    };
  }

  return null;
}

/* ── Writes ────────────────────────────────────────────────────────────── */

export interface CreateTemplateRecord {
  name: string;
  description: string;
  academyId: string | null;
  programmeId: string | null;
  actorUid: string;
  branchId: string;
}

export async function createTemplateRecord(
  record: CreateTemplateRecord,
): Promise<{ templateId: string; versionId: string }> {
  const db = adminDb();
  const now = new Date();
  const templateRef = db.collection(TEMPLATES).doc();
  const versionRef = templateRef.collection(VERSIONS).doc();

  const batch = db.batch();
  batch.set(templateRef, {
    schemaVersion: 1,
    branchId: record.branchId,
    name: record.name,
    description: record.description,
    academyId: record.academyId,
    programmeId: record.programmeId,
    activeVersionId: null,
    activeVersionNumber: null,
    latestVersionNumber: 1,
    createdAt: now,
    createdBy: record.actorUid,
    updatedAt: now,
    updatedBy: record.actorUid,
  });
  batch.set(versionRef, {
    schemaVersion: 1,
    templateId: templateRef.id,
    versionNumber: 1,
    status: 'draft',
    artwork: null,
    fields: defaultTemplateFields(),
    signatories: defaultSignatories(),
    submittedAt: null,
    submittedBy: null,
    approvedAt: null,
    approvedBy: null,
    activatedAt: null,
    activatedBy: null,
    archivedAt: null,
    archivedBy: null,
    createdAt: now,
    createdBy: record.actorUid,
    updatedAt: now,
    updatedBy: record.actorUid,
  });
  await batch.commit();

  return { templateId: templateRef.id, versionId: versionRef.id };
}

export async function updateTemplateMeta(
  templateId: string,
  patch: {
    name: string;
    description: string;
    academyId: string | null;
    programmeId: string | null;
  },
  actorUid: string,
): Promise<void> {
  await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .update({ ...patch, updatedAt: new Date(), updatedBy: actorUid });
}

/** Only a DRAFT version's configuration may be mutated in place. */
async function assertDraft(templateId: string, versionId: string): Promise<void> {
  const snap = await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .collection(VERSIONS)
    .doc(versionId)
    .get();
  if (!snap.exists) throw new Error('not_found');
  if (asString(snap.get('status')) !== 'draft') throw new Error('not_draft');
}

export async function setVersionArtwork(
  templateId: string,
  versionId: string,
  artwork: ArtworkMeta,
  actorUid: string,
): Promise<void> {
  await assertDraft(templateId, versionId);
  await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .collection(VERSIONS)
    .doc(versionId)
    .update({ artwork, updatedAt: new Date(), updatedBy: actorUid });
}

export async function setVersionFields(
  templateId: string,
  versionId: string,
  fields: TemplateFields,
  actorUid: string,
): Promise<void> {
  await assertDraft(templateId, versionId);
  await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .collection(VERSIONS)
    .doc(versionId)
    .update({ fields, updatedAt: new Date(), updatedBy: actorUid });
}

export async function setVersionSignatoryInfo(
  templateId: string,
  versionId: string,
  slot: SignatureSlot,
  name: string,
  designation: string,
  actorUid: string,
): Promise<void> {
  await assertDraft(templateId, versionId);
  await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .collection(VERSIONS)
    .doc(versionId)
    .update({
      [`signatories.${slot}.name`]: name,
      [`signatories.${slot}.designation`]: designation,
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
}

export async function setVersionSignatureImage(
  templateId: string,
  versionId: string,
  slot: SignatureSlot,
  storagePath: string,
  actorUid: string,
): Promise<void> {
  await assertDraft(templateId, versionId);
  await adminDb()
    .collection(TEMPLATES)
    .doc(templateId)
    .collection(VERSIONS)
    .doc(versionId)
    .update({
      [`signatories.${slot}.storagePath`]: storagePath,
      updatedAt: new Date(),
      updatedBy: actorUid,
    });
}

export type TransitionOutcome =
  | { kind: 'ok' }
  | { kind: 'invalid_transition' }
  | { kind: 'validation_failed'; errors: string[] }
  | { kind: 'assignment_conflict'; conflictingTemplateName: string };

/** Submits a DRAFT version for review. */
export async function submitVersionForReview(
  templateId: string,
  versionId: string,
  actorUid: string,
): Promise<TransitionOutcome> {
  const db = adminDb();
  const ref = db.collection(TEMPLATES).doc(templateId).collection(VERSIONS).doc(versionId);
  const snap = await ref.get();
  if (!snap.exists || asString(snap.get('status')) !== 'draft')
    return { kind: 'invalid_transition' };

  const now = new Date();
  await ref.update({
    status: 'review',
    submittedAt: now,
    submittedBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return { kind: 'ok' };
}

/** Approves a REVIEW version. */
export async function approveVersion(
  templateId: string,
  versionId: string,
  actorUid: string,
): Promise<TransitionOutcome> {
  const db = adminDb();
  const ref = db.collection(TEMPLATES).doc(templateId).collection(VERSIONS).doc(versionId);
  const snap = await ref.get();
  if (!snap.exists || asString(snap.get('status')) !== 'review')
    return { kind: 'invalid_transition' };

  const now = new Date();
  await ref.update({
    status: 'approved',
    approvedAt: now,
    approvedBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  });
  return { kind: 'ok' };
}

/**
 * Activates an APPROVED version. Runs entirely inside a transaction because
 * three invariants must hold atomically: (1) no ambiguous active assignment
 * for the same programme/academy across a *different* template, (2) the
 * template's previously active version (if any) is archived in the same
 * moment the new one goes live, (3) `certificateTemplates.activeVersionId`
 * always points at exactly the version currently eligible for issuance.
 */
export async function activateVersion(
  templateId: string,
  versionId: string,
  actorUid: string,
): Promise<TransitionOutcome> {
  const db = adminDb();
  const templateRef = db.collection(TEMPLATES).doc(templateId);
  const versionRef = templateRef.collection(VERSIONS).doc(versionId);

  return db.runTransaction(async (tx) => {
    const [templateSnap, versionSnap] = await Promise.all([
      tx.get(templateRef),
      tx.get(versionRef),
    ]);
    if (!templateSnap.exists || !versionSnap.exists) return { kind: 'invalid_transition' };
    if (asString(versionSnap.get('status')) !== 'approved') return { kind: 'invalid_transition' };

    const artwork = toArtwork(versionSnap.get('artwork'));
    const fields = (versionSnap.get('fields') ?? {}) as TemplateFields;
    const signatoriesData = (versionSnap.get('signatories') ?? {}) as Record<string, unknown>;
    const toSig = (raw: unknown) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      return {
        name: asString(s.name),
        designation: asString(s.designation),
        storagePath: asStringOrNull(s.storagePath),
      };
    };
    const signatories: Signatories = {
      signature1: toSig(signatoriesData.signature1),
      signature2: toSig(signatoriesData.signature2),
    };

    const check = validateForActivation({ artwork, fields, signatories });
    if (!check.ok) return { kind: 'validation_failed', errors: check.errors };

    const programmeId = asStringOrNull(templateSnap.get('programmeId'));
    const academyId = asStringOrNull(templateSnap.get('academyId'));

    // Ambiguity guard: no other template may already be active for the same
    // programme (or, for an academy-level template, the same academy).
    const conflictQuery = programmeId
      ? db.collection(TEMPLATES).where('programmeId', '==', programmeId)
      : db
          .collection(TEMPLATES)
          .where('academyId', '==', academyId)
          .where('programmeId', '==', null);
    const conflictSnap = await tx.get(conflictQuery.limit(10));
    const conflict = conflictSnap.docs.find(
      (d) => d.id !== templateId && asStringOrNull(d.get('activeVersionId')),
    );
    if (conflict) {
      return {
        kind: 'assignment_conflict',
        conflictingTemplateName: asString(conflict.get('name')),
      };
    }

    const now = new Date();
    const previousActiveVersionId = asStringOrNull(templateSnap.get('activeVersionId'));
    if (previousActiveVersionId && previousActiveVersionId !== versionId) {
      tx.update(templateRef.collection(VERSIONS).doc(previousActiveVersionId), {
        status: 'archived',
        archivedAt: now,
        archivedBy: actorUid,
        updatedAt: now,
        updatedBy: actorUid,
      });
    }

    tx.update(versionRef, {
      status: 'active',
      activatedAt: now,
      activatedBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });

    const versionNumber = asNumber(versionSnap.get('versionNumber'));
    tx.update(templateRef, {
      activeVersionId: versionId,
      activeVersionNumber: versionNumber,
      updatedAt: now,
      updatedBy: actorUid,
    });

    return { kind: 'ok' };
  });
}

/** Archives any non-archived version. If it was the active one, the template loses its active pointer. */
export async function archiveVersion(
  templateId: string,
  versionId: string,
  actorUid: string,
): Promise<TransitionOutcome> {
  const db = adminDb();
  const templateRef = db.collection(TEMPLATES).doc(templateId);
  const versionRef = templateRef.collection(VERSIONS).doc(versionId);

  return db.runTransaction(async (tx) => {
    const [templateSnap, versionSnap] = await Promise.all([
      tx.get(templateRef),
      tx.get(versionRef),
    ]);
    if (!templateSnap.exists || !versionSnap.exists) return { kind: 'invalid_transition' };
    if (asString(versionSnap.get('status')) === 'archived') return { kind: 'invalid_transition' };

    const now = new Date();
    tx.update(versionRef, {
      status: 'archived',
      archivedAt: now,
      archivedBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });

    if (asStringOrNull(templateSnap.get('activeVersionId')) === versionId) {
      tx.update(templateRef, {
        activeVersionId: null,
        activeVersionNumber: null,
        updatedAt: now,
        updatedBy: actorUid,
      });
    }

    return { kind: 'ok' };
  });
}

/**
 * Clones the template's latest version's configuration into a brand-new
 * DRAFT version — the only way to change an approved/active/archived
 * version's layout without mutating the historical record in place.
 */
export async function createNewDraftVersion(
  templateId: string,
  actorUid: string,
): Promise<{ versionId: string; versionNumber: number } | null> {
  const db = adminDb();
  const templateRef = db.collection(TEMPLATES).doc(templateId);

  return db.runTransaction(async (tx) => {
    const templateSnap = await tx.get(templateRef);
    if (!templateSnap.exists) return null;

    const latestVersionNumber = asNumber(templateSnap.get('latestVersionNumber')) || 1;
    const versionsSnap = await templateRef
      .collection(VERSIONS)
      .orderBy('versionNumber', 'desc')
      .limit(1)
      .get();
    const latest = versionsSnap.docs[0];

    const now = new Date();
    const newVersionRef = templateRef.collection(VERSIONS).doc();
    const nextNumber = latestVersionNumber + 1;

    tx.set(newVersionRef, {
      schemaVersion: 1,
      templateId,
      versionNumber: nextNumber,
      status: 'draft',
      artwork: latest ? (latest.get('artwork') ?? null) : null,
      fields: latest ? (latest.get('fields') ?? defaultTemplateFields()) : defaultTemplateFields(),
      signatories: latest
        ? (latest.get('signatories') ?? defaultSignatories())
        : defaultSignatories(),
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      approvedBy: null,
      activatedAt: null,
      activatedBy: null,
      archivedAt: null,
      archivedBy: null,
      createdAt: now,
      createdBy: actorUid,
      updatedAt: now,
      updatedBy: actorUid,
    });

    tx.update(templateRef, {
      latestVersionNumber: nextNumber,
      updatedAt: now,
      updatedBy: actorUid,
    });

    return { versionId: newVersionRef.id, versionNumber: nextNumber };
  });
}
