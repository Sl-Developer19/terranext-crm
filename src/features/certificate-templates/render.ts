import 'server-only';

import { adminBucket } from '@/lib/firebase/admin';
import { renderQrPngBuffer } from '@/lib/qrcode';

import { certificatePdfStoragePath } from './paths';
import {
  renderCertificatePdf,
  type CertificateRenderAssets,
  type CertificateRenderData,
} from './pdf';
import { findVersion } from './repository';
import type { TemplateVersion } from './schema';

/**
 * Bridges the template engine to actual certificate issuance/preview. Not a
 * server action itself — called from the `certificates` feature's issuance
 * action and from this feature's own preview action.
 */

async function downloadOrNull(storagePath: string | null): Promise<Buffer | null> {
  if (!storagePath) return null;
  const [bytes] = await adminBucket().file(storagePath).download();
  return bytes;
}

async function fetchAssets(
  version: TemplateVersion,
  qrTargetUrl: string,
): Promise<CertificateRenderAssets | null> {
  if (!version.artwork) return null;

  const [artworkBytes, signature1Bytes, signature2Bytes, qrPngBytes] = await Promise.all([
    adminBucket()
      .file(version.artwork.storagePath)
      .download()
      .then(([b]) => b),
    downloadOrNull(version.signatories.signature1.storagePath),
    downloadOrNull(version.signatories.signature2.storagePath),
    renderQrPngBuffer(qrTargetUrl),
  ]);

  return {
    artworkBytes,
    artworkMimeType: version.artwork.mimeType,
    artworkWidthPx: version.artwork.widthPx,
    artworkHeightPx: version.artwork.heightPx,
    signature1Bytes,
    signature2Bytes,
    qrPngBytes,
  };
}

function signatoryData(version: TemplateVersion) {
  return {
    signatoryName1: version.signatories.signature1.name,
    signatoryDesignation1: version.signatories.signature1.designation,
    signatoryName2: version.signatories.signature2.name,
    signatoryDesignation2: version.signatories.signature2.designation,
  };
}

export interface IssuedCertificateRenderInput {
  certificateId: string;
  templateId: string;
  templateVersionId: string;
  verifyUrl: string;
  participantName: string;
  programmeName: string;
  academyName: string;
  completionDate: string;
  duration: string;
}

export type RenderResult =
  { kind: 'stored'; storagePath: string } | { kind: 'no_artwork' } | { kind: 'version_not_found' };

/** Renders a real, issued certificate's PDF and stores it in Storage — never used for preview data. */
export async function renderAndStoreCertificatePdf(
  input: IssuedCertificateRenderInput,
): Promise<RenderResult> {
  const version = await findVersion(input.templateId, input.templateVersionId);
  if (!version) return { kind: 'version_not_found' };

  const assets = await fetchAssets(version, input.verifyUrl);
  if (!assets) return { kind: 'no_artwork' };

  const data: CertificateRenderData = {
    participantName: input.participantName,
    programmeName: input.programmeName,
    academyName: input.academyName,
    completionDate: input.completionDate,
    certificateId: input.certificateId,
    duration: input.duration,
    ...signatoryData(version),
  };

  const pdfBytes = await renderCertificatePdf(version.fields, data, assets);
  const storagePath = certificatePdfStoragePath(input.certificateId);
  await adminBucket()
    .file(storagePath)
    .save(pdfBytes, { contentType: 'application/pdf', resumable: false });

  return { kind: 'stored', storagePath };
}

export type PreviewResult =
  { kind: 'ok'; base64: string } | { kind: 'no_artwork' } | { kind: 'version_not_found' };

/**
 * Renders a preview PDF from a template version's CURRENT configuration
 * using clearly-fake sample data — never touches the certificate registry,
 * never persists anything, returns bytes only for inline display.
 */
export async function renderPreviewPdf(
  templateId: string,
  versionId: string,
  previewVerifyUrl: string,
): Promise<PreviewResult> {
  const version = await findVersion(templateId, versionId);
  if (!version) return { kind: 'version_not_found' };

  const assets = await fetchAssets(version, previewVerifyUrl);
  if (!assets) return { kind: 'no_artwork' };

  const data: CertificateRenderData = {
    participantName: 'Sample Participant',
    programmeName: 'Sample Programme',
    academyName: 'Sample Academy',
    completionDate: '01 January 2026',
    certificateId: 'TN-SAMPLE-000001',
    duration: 'Sample Duration',
    ...signatoryData(version),
  };

  const pdfBytes = await renderCertificatePdf(version.fields, data, assets);
  return { kind: 'ok', base64: pdfBytes.toString('base64') };
}
