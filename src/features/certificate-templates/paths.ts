/** Firebase Storage path builders for the Certificate Template Engine. */

function extensionFor(contentType: 'image/png' | 'image/jpeg'): string {
  return contentType === 'image/png' ? 'png' : 'jpg';
}

/**
 * One deterministic path per (template, version) — a re-upload while still
 * DRAFT simply overwrites it, which is correct: only a draft's assets may
 * change, and once approved/active the version (and its artwork) is frozen.
 */
export function templateArtworkStoragePath(
  templateId: string,
  versionId: string,
  contentType: 'image/png' | 'image/jpeg',
): string {
  return `certificateTemplates/${templateId}/${versionId}/artwork.${extensionFor(contentType)}`;
}

export function templateSignatureStoragePath(
  templateId: string,
  versionId: string,
  slot: 'signature1' | 'signature2',
  contentType: 'image/png' | 'image/jpeg',
): string {
  return `certificateTemplates/${templateId}/${versionId}/${slot}.${extensionFor(contentType)}`;
}

/** Generated certificate PDF — one per issued certificate, never overwritten. */
export function certificatePdfStoragePath(certificateId: string): string {
  return `certificates/${certificateId}/certificate.pdf`;
}
