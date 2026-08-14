/** Public API of the certificate-templates feature (Doc 02 §3). */
export { CreateTemplateDialog } from './components/create-template-dialog';
export { TemplateDetail } from './components/template-detail';
export { TemplateEditor } from './components/template-editor';
export { TemplateList } from './components/template-list';
export {
  activateTemplateAction,
  approveTemplateAction,
  archiveTemplateAction,
  confirmArtworkUploadAction,
  confirmSignatureUploadAction,
  createNewDraftVersionAction,
  createTemplateAction,
  getVersionAssetUrlsAction,
  previewTemplateAction,
  requestArtworkUploadTicketAction,
  requestSignatureUploadTicketAction,
  submitTemplateForReviewAction,
  updateSignatoryInfoAction,
  updateTemplateMetaAction,
  updateVersionFieldsAction,
} from './actions/manage-template';
export { getTemplateDetail, getTemplateVersion, listTemplates } from './queries';
export { findActiveTemplateForAssignment } from './repository';
export { renderAndStoreCertificatePdf } from './render';
export {
  canActivate,
  canApprove,
  canArchive,
  canEditVersion,
  canSubmitForReview,
  defaultSignatories,
  defaultTemplateFields,
  validateForActivation,
} from './logic';
export {
  ARTWORK_MAX_BYTES,
  ARTWORK_MIME_TYPES,
  IMAGE_FIELD_KEYS,
  SIGNATURE_MAX_BYTES,
  SIGNATURE_MIME_TYPES,
  SIGNATURE_SLOTS,
  TEMPLATE_FONT_FAMILIES,
  TEMPLATE_VERSION_STATUSES,
  TEXT_FIELD_KEYS,
  type ArtworkMeta,
  type ArtworkUploadTicket,
  type CertificateTemplate,
  type CreateTemplateInput,
  type ImageFieldConfig,
  type ImageFieldKey,
  type QrFieldConfig,
  type Signatories,
  type Signatory,
  type SignatureSlot,
  type SignatureUploadTicket,
  type TemplateFields,
  type TemplateFontFamily,
  type TemplateVersion,
  type TemplateVersionStatus,
  type TextFieldConfig,
  type TextFieldKey,
} from './schema';
