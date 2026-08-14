import 'server-only';

import { findTemplateById, findTemplates, findVersion, findVersions } from './repository';
import type { CertificateTemplate, TemplateVersion } from './schema';

/** Read models for the Certificate Templates admin UI. */

export async function listTemplates(): Promise<CertificateTemplate[]> {
  return findTemplates();
}

export async function getTemplateDetail(
  templateId: string,
): Promise<{ template: CertificateTemplate | null; versions: TemplateVersion[] }> {
  const [template, versions] = await Promise.all([
    findTemplateById(templateId),
    findVersions(templateId),
  ]);
  return { template, versions };
}

export async function getTemplateVersion(
  templateId: string,
  versionId: string,
): Promise<TemplateVersion | null> {
  return findVersion(templateId, versionId);
}
