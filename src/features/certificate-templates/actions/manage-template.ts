'use server';

import { writeAudit } from '@/lib/audit/write';
import { getSession } from '@/lib/auth/session';
import { adminBucket } from '@/lib/firebase/admin';
import { appOrigin } from '@/lib/http/app-origin';
import { can } from '@/lib/rbac/permissions';
import {
  conflictError,
  internalError,
  notFoundError,
  ok,
  permissionError,
  preconditionError,
  validationError,
  type Result,
} from '@/lib/utils/result';

import { listAcademies, listProgrammes } from '@/features/catalogue';

import { canEditVersion } from '../logic';
import { templateArtworkStoragePath, templateSignatureStoragePath } from '../paths';
import { renderPreviewPdf } from '../render';
import {
  activateVersion,
  approveVersion,
  archiveVersion,
  createNewDraftVersion,
  createTemplateRecord,
  findTemplateById,
  findVersion,
  setVersionArtwork,
  setVersionFields,
  setVersionSignatoryInfo,
  setVersionSignatureImage,
  submitVersionForReview,
  updateTemplateMeta,
} from '../repository';
import {
  confirmArtworkUploadSchema,
  confirmSignatureUploadSchema,
  createTemplateSchema,
  requestArtworkUploadSchema,
  requestSignatureUploadSchema,
  updateSignatoryInfoSchema,
  updateTemplateMetaSchema,
  updateVersionFieldsSchema,
  versionRefSchema,
  type ArtworkUploadTicket,
  type ConfirmArtworkUploadInput,
  type ConfirmSignatureUploadInput,
  type CreateTemplateInput,
  type RequestArtworkUploadInput,
  type RequestSignatureUploadInput,
  type SignatureUploadTicket,
  type UpdateSignatoryInfoInput,
  type UpdateTemplateMetaInput,
  type UpdateVersionFieldsInput,
  type VersionRefInput,
} from '../schema';

/**
 * Certificate Template Engine — admin management actions. Every mutating
 * action here is gated on `certificates:configure` (system_admin/founder
 * only, Doc 04 §3) and audited (BR-06). Only a DRAFT version's config may be
 * edited in place; approved/active/archived versions are immutable history.
 */

const UPLOAD_URL_TTL_MS = 15 * 60 * 1_000;

function fieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.join('.') || 'form'] ??= issue.message;
  return fields;
}

/** Validates an academy/programme assignment against the real catalogue — never invented. */
async function validateAssignment(
  academyId: string | null,
  programmeId: string | null,
): Promise<Record<string, string> | null> {
  if (academyId) {
    const academies = await listAcademies();
    if (!academies.some((a) => a.id === academyId)) return { academyId: 'Academy not found.' };
  }
  if (programmeId) {
    const programmes = await listProgrammes();
    if (!programmes.some((p) => p.id === programmeId))
      return { programmeId: 'Programme not found.' };
  }
  return null;
}

async function requireConfigureSession() {
  const session = await getSession();
  if (!session) return { session: null, error: permissionError('Sign in required.') };
  if (!can(session.role, 'certificates:configure')) {
    return {
      session: null,
      error: permissionError('Only a System Administrator can manage certificate templates.'),
    };
  }
  return { session, error: null };
}

const ASSET_URL_TTL_MS = 15 * 60 * 1_000;

/** Short-lived read URLs so the editor/detail UI can display private Storage assets. */
export async function getVersionAssetUrlsAction(
  input: VersionRefInput,
): Promise<
  Result<{ artworkUrl: string | null; signature1Url: string | null; signature2Url: string | null }>
> {
  const session = await getSession();
  if (!session) return permissionError('Sign in required.');
  if (!can(session.role, 'certificates:view')) return permissionError();

  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid request.' });
  const { templateId, versionId } = parsed.data;

  try {
    const version = await findVersion(templateId, versionId);
    if (!version) return notFoundError('Template version not found.');

    const bucket = adminBucket();
    const sign = async (storagePath: string | null): Promise<string | null> => {
      if (!storagePath) return null;
      const [url] = await bucket
        .file(storagePath)
        .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + ASSET_URL_TTL_MS });
      return url;
    };

    const [artworkUrl, signature1Url, signature2Url] = await Promise.all([
      sign(version.artwork?.storagePath ?? null),
      sign(version.signatories.signature1.storagePath),
      sign(version.signatories.signature2.storagePath),
    ]);

    return ok({ artworkUrl, signature1Url, signature2Url });
  } catch {
    return internalError('Could not load template assets. Please try again.');
  }
}

export async function createTemplateAction(
  input: CreateTemplateInput,
): Promise<Result<{ templateId: string; versionId: string }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { name, description, academyId, programmeId } = parsed.data;

  try {
    const assignmentError = await validateAssignment(academyId, programmeId);
    if (assignmentError) return validationError(assignmentError);

    const created = await createTemplateRecord({
      name,
      description: description ?? '',
      academyId,
      programmeId,
      actorUid: session.uid,
      branchId: session.branchId,
    });

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'certificate_template',
      entityId: created.templateId,
      entityPath: `certificateTemplates/${created.templateId}`,
      context: { feature: 'certificate-templates' },
    });

    return ok(created);
  } catch {
    return internalError('Could not create the template. Please try again.');
  }
}

export async function updateTemplateMetaAction(
  input: UpdateTemplateMetaInput,
): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = updateTemplateMetaSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { templateId, name, description, academyId, programmeId } = parsed.data;

  try {
    const existing = await findTemplateById(templateId);
    if (!existing) return notFoundError('Template not found.');
    const assignmentError = await validateAssignment(academyId, programmeId);
    if (assignmentError) return validationError(assignmentError);

    await updateTemplateMeta(
      templateId,
      { name, description: description ?? '', academyId, programmeId },
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}`,
      changes: {
        academyId: { before: existing.academyId, after: academyId },
        programmeId: { before: existing.programmeId, after: programmeId },
      },
      context: { feature: 'certificate-templates' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not update the template. Please try again.');
  }
}

export async function requestArtworkUploadTicketAction(
  input: RequestArtworkUploadInput,
): Promise<Result<ArtworkUploadTicket>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = requestArtworkUploadSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { templateId, versionId, contentType } = parsed.data;

  try {
    const version = await findVersion(templateId, versionId);
    if (!version) return notFoundError('Template version not found.');
    if (!canEditVersion(version.status)) {
      return conflictError('Only a draft version can have its artwork replaced.');
    }

    const storagePath = templateArtworkStoragePath(templateId, versionId, contentType);
    const [uploadUrl] = await adminBucket()
      .file(storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        contentType,
      });

    return ok({ versionId, uploadUrl, contentType });
  } catch {
    return internalError('Could not start the upload. Please try again.');
  }
}

export async function confirmArtworkUploadAction(
  input: ConfirmArtworkUploadInput,
): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = confirmArtworkUploadSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { templateId, versionId, contentType, sizeBytes, widthPx, heightPx } = parsed.data;

  try {
    const version = await findVersion(templateId, versionId);
    if (!version) return notFoundError('Template version not found.');
    if (!canEditVersion(version.status)) {
      return conflictError('Only a draft version can have its artwork replaced.');
    }

    const storagePath = templateArtworkStoragePath(templateId, versionId, contentType);
    const file = adminBucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists)
      return validationError({ artwork: 'The artwork upload did not complete. Please try again.' });

    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size ?? 0);
    const actualType = metadata.contentType ?? '';
    if (actualType !== contentType || actualSize !== sizeBytes) {
      await file.delete().catch(() => undefined);
      return validationError({
        artwork: 'The uploaded file did not match what was declared. Please re-upload.',
      });
    }

    await setVersionArtwork(
      templateId,
      versionId,
      { storagePath, mimeType: contentType, widthPx, heightPx, sizeBytes },
      session.uid,
    );

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}/versions/${versionId}`,
      context: { feature: 'certificate-templates', reason: 'artwork_upload' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not confirm the artwork upload. Please try again.');
  }
}

export async function requestSignatureUploadTicketAction(
  input: RequestSignatureUploadInput,
): Promise<Result<SignatureUploadTicket>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = requestSignatureUploadSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { templateId, versionId, slot, contentType } = parsed.data;

  try {
    const version = await findVersion(templateId, versionId);
    if (!version) return notFoundError('Template version not found.');
    if (!canEditVersion(version.status)) {
      return conflictError('Only a draft version can have its signatures replaced.');
    }

    const storagePath = templateSignatureStoragePath(templateId, versionId, slot, contentType);
    const [uploadUrl] = await adminBucket()
      .file(storagePath)
      .getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + UPLOAD_URL_TTL_MS,
        contentType,
      });

    return ok({ versionId, slot, uploadUrl, contentType });
  } catch {
    return internalError('Could not start the upload. Please try again.');
  }
}

export async function confirmSignatureUploadAction(
  input: ConfirmSignatureUploadInput,
): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = confirmSignatureUploadSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { templateId, versionId, slot, contentType, sizeBytes } = parsed.data;

  try {
    const version = await findVersion(templateId, versionId);
    if (!version) return notFoundError('Template version not found.');
    if (!canEditVersion(version.status)) {
      return conflictError('Only a draft version can have its signatures replaced.');
    }

    const storagePath = templateSignatureStoragePath(templateId, versionId, slot, contentType);
    const file = adminBucket().file(storagePath);
    const [exists] = await file.exists();
    if (!exists)
      return validationError({
        signature: 'The signature upload did not complete. Please try again.',
      });

    const [metadata] = await file.getMetadata();
    const actualSize = Number(metadata.size ?? 0);
    const actualType = metadata.contentType ?? '';
    if (actualType !== contentType || actualSize !== sizeBytes) {
      await file.delete().catch(() => undefined);
      return validationError({
        signature: 'The uploaded file did not match what was declared. Please re-upload.',
      });
    }

    await setVersionSignatureImage(templateId, versionId, slot, storagePath, session.uid);

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'update',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}/versions/${versionId}`,
      context: { feature: 'certificate-templates', reason: `signature_upload:${slot}` },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not confirm the signature upload. Please try again.');
  }
}

export async function updateSignatoryInfoAction(
  input: UpdateSignatoryInfoInput,
): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = updateSignatoryInfoSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { templateId, versionId, slot, name, designation } = parsed.data;

  try {
    const version = await findVersion(templateId, versionId);
    if (!version) return notFoundError('Template version not found.');
    if (!canEditVersion(version.status))
      return conflictError('Only a draft version can be edited.');

    await setVersionSignatoryInfo(templateId, versionId, slot, name, designation, session.uid);
    return ok({ ok: true });
  } catch {
    return internalError('Could not save the signatory. Please try again.');
  }
}

export async function updateVersionFieldsAction(
  input: UpdateVersionFieldsInput,
): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = updateVersionFieldsSchema.safeParse(input);
  if (!parsed.success) return validationError(fieldErrors(parsed.error.issues));
  const { templateId, versionId, fields } = parsed.data;

  try {
    const version = await findVersion(templateId, versionId);
    if (!version) return notFoundError('Template version not found.');
    if (!canEditVersion(version.status))
      return conflictError('Only a draft version can be edited.');

    await setVersionFields(templateId, versionId, fields, session.uid);
    return ok({ ok: true });
  } catch {
    return internalError('Could not save the field layout. Please try again.');
  }
}

export async function submitTemplateForReviewAction(
  input: VersionRefInput,
): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid request.' });
  const { templateId, versionId } = parsed.data;

  try {
    const outcome = await submitVersionForReview(templateId, versionId, session.uid);
    if (outcome.kind === 'invalid_transition') {
      return conflictError('This version cannot be submitted for review from its current status.');
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}/versions/${versionId}`,
      changes: { status: { before: 'draft', after: 'review' } },
      context: { feature: 'certificate-templates' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not submit the template for review. Please try again.');
  }
}

export async function approveTemplateAction(input: VersionRefInput): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid request.' });
  const { templateId, versionId } = parsed.data;

  try {
    const outcome = await approveVersion(templateId, versionId, session.uid);
    if (outcome.kind === 'invalid_transition') {
      return conflictError('This version cannot be approved from its current status.');
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}/versions/${versionId}`,
      changes: { status: { before: 'review', after: 'approved' } },
      context: { feature: 'certificate-templates' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not approve the template. Please try again.');
  }
}

export async function activateTemplateAction(
  input: VersionRefInput,
): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid request.' });
  const { templateId, versionId } = parsed.data;

  try {
    const outcome = await activateVersion(templateId, versionId, session.uid);
    if (outcome.kind === 'invalid_transition') {
      return conflictError('This version cannot be activated from its current status.');
    }
    if (outcome.kind === 'validation_failed') {
      return preconditionError('BR-03', outcome.errors.join(' '));
    }
    if (outcome.kind === 'assignment_conflict') {
      return conflictError(
        `"${outcome.conflictingTemplateName}" is already the active template for this assignment. Archive it before activating this one.`,
      );
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}/versions/${versionId}`,
      changes: { status: { before: 'approved', after: 'active' } },
      context: { feature: 'certificate-templates' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not activate the template. Please try again.');
  }
}

export async function archiveTemplateAction(input: VersionRefInput): Promise<Result<{ ok: true }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid request.' });
  const { templateId, versionId } = parsed.data;

  try {
    const outcome = await archiveVersion(templateId, versionId, session.uid);
    if (outcome.kind === 'invalid_transition') {
      return conflictError('This version is already archived.');
    }

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'status_change',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}/versions/${versionId}`,
      changes: { status: { before: null, after: 'archived' } },
      context: { feature: 'certificate-templates' },
    });

    return ok({ ok: true });
  } catch {
    return internalError('Could not archive the template. Please try again.');
  }
}

export async function createNewDraftVersionAction(input: {
  templateId: string;
}): Promise<Result<{ versionId: string; versionNumber: number }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const templateId = typeof input.templateId === 'string' ? input.templateId : '';
  if (!templateId) return validationError({ templateId: 'Invalid request.' });

  try {
    const template = await findTemplateById(templateId);
    if (!template) return notFoundError('Template not found.');

    const created = await createNewDraftVersion(templateId, session.uid);
    if (!created) return internalError('Could not create a new version.');

    await writeAudit({
      actorUid: session.uid,
      actorRole: session.role,
      action: 'create',
      entityType: 'certificate_template',
      entityId: templateId,
      entityPath: `certificateTemplates/${templateId}/versions/${created.versionId}`,
      context: { feature: 'certificate-templates', reason: 'new_version' },
    });

    return ok(created);
  } catch {
    return internalError('Could not create a new version. Please try again.');
  }
}

/**
 * Renders a preview PDF from the version's current configuration using
 * fixed, clearly-fake sample data. Never touches the certificate registry —
 * this is the one guarantee the whole preview feature exists to provide.
 * The QR still points at the real `/verify` page so the admin sees exactly
 * where a scan will land, but with a number that resolves to `valid: false`
 * (no certificate with that number will ever exist), never a real record.
 */
export async function previewTemplateAction(
  input: VersionRefInput,
): Promise<Result<{ pdfBase64: string }>> {
  const { session, error } = await requireConfigureSession();
  if (!session) return error!;

  const parsed = versionRefSchema.safeParse(input);
  if (!parsed.success) return validationError({ form: 'Invalid request.' });
  const { templateId, versionId } = parsed.data;

  try {
    const origin = await appOrigin();
    const previewVerifyUrl = `${origin.replace(/\/$/, '')}/verify?no=PREVIEW-SAMPLE&hash=preview`;

    const result = await renderPreviewPdf(templateId, versionId, previewVerifyUrl);
    if (result.kind === 'version_not_found') return notFoundError('Template version not found.');
    if (result.kind === 'no_artwork') {
      return validationError({ artwork: 'Upload the certificate artwork before previewing.' });
    }

    return ok({ pdfBase64: result.base64 });
  } catch {
    return internalError('Could not render the preview. Please try again.');
  }
}
