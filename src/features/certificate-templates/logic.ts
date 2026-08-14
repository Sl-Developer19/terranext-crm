import type {
  ArtworkMeta,
  Signatories,
  Signatory,
  TemplateFields,
  TemplateVersionStatus,
} from './schema';

/**
 * Pure business rules for the Certificate Template Engine — no Firestore, no
 * Storage, testable without an emulator (Doc 02 §6 `logic.ts` isolation).
 */

export function canEditVersion(status: TemplateVersionStatus): boolean {
  return status === 'draft';
}

export function canSubmitForReview(status: TemplateVersionStatus): boolean {
  return status === 'draft';
}

export function canApprove(status: TemplateVersionStatus): boolean {
  return status === 'review';
}

export function canActivate(status: TemplateVersionStatus): boolean {
  return status === 'approved';
}

/** Anything not already archived can be archived — including a live ACTIVE version. */
export function canArchive(status: TemplateVersionStatus): boolean {
  return status !== 'archived';
}

function hasSignatory(signatory: Signatory): boolean {
  return (
    signatory.name.trim().length > 0 &&
    signatory.designation.trim().length > 0 &&
    signatory.storagePath !== null
  );
}

export interface ActivationCheck {
  ok: boolean;
  errors: string[];
}

/**
 * Only an APPROVED/ACTIVE-eligible version may generate certificates — this
 * is the gate checked before ACTIVATE is allowed to succeed at all.
 */
export function validateForActivation(params: {
  artwork: ArtworkMeta | null;
  fields: TemplateFields;
  signatories: Signatories;
}): ActivationCheck {
  const errors: string[] = [];

  if (!params.artwork) {
    errors.push('Upload the certificate artwork before activating this version.');
  }
  if (!params.fields.participantName.visible) {
    errors.push('The participant name field must be mapped and visible.');
  }
  if (!params.fields.completionDate.visible) {
    errors.push('The completion date field must be mapped and visible.');
  }
  if (!params.fields.certificateId.visible) {
    errors.push('The certificate ID field must be mapped and visible.');
  }
  if (!params.fields.verificationQr.visible) {
    errors.push('The verification QR field must be mapped and visible.');
  }
  if (params.fields.signature1.visible && !hasSignatory(params.signatories.signature1)) {
    errors.push('Signature 1 is mapped but has no name, designation, and image configured.');
  }
  if (params.fields.signature2.visible && !hasSignatory(params.signatories.signature2)) {
    errors.push('Signature 2 is mapped but has no name, designation, and image configured.');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Print-quality assumption for turning uploaded artwork pixel dimensions into
 * a PDF page size while preserving aspect ratio exactly (no stretch, no
 * distortion). No DPI is embedded in the uploaded file itself, so a fixed
 * assumption is the only option short of asking the admin to specify one —
 * flagged here rather than silently guessed elsewhere.
 */
export const ASSUMED_ARTWORK_DPI = 150;

export function artworkPageSizePt(
  widthPx: number,
  heightPx: number,
): { widthPt: number; heightPt: number } {
  return {
    widthPt: (widthPx / ASSUMED_ARTWORK_DPI) * 72,
    heightPt: (heightPx / ASSUMED_ARTWORK_DPI) * 72,
  };
}

const baseText = {
  visible: false,
  x: 0.1,
  y: 0.1,
  width: 0.8,
  height: 0.08,
  fontFamily: 'Helvetica' as const,
  fontSize: 18,
  fontWeight: 'normal' as const,
  color: '#1A1A1A',
  align: 'center' as const,
  lineHeight: 1.2,
  letterSpacing: 0,
};

/**
 * Starting layout for a brand-new draft version — a generic, fully editable
 * default, not a fixed design. Every value is stored per-template and can be
 * repositioned; nothing here is read by the PDF renderer directly except
 * through the template document itself.
 */
export function defaultTemplateFields(): TemplateFields {
  return {
    academyName: {
      ...baseText,
      visible: true,
      x: 0.1,
      y: 0.08,
      width: 0.8,
      height: 0.06,
      fontSize: 14,
    },
    participantName: {
      ...baseText,
      visible: true,
      x: 0.1,
      y: 0.4,
      width: 0.8,
      height: 0.12,
      fontFamily: 'TimesRomanBold',
      fontSize: 34,
      fontWeight: 'bold',
    },
    programmeName: {
      ...baseText,
      visible: true,
      x: 0.15,
      y: 0.53,
      width: 0.7,
      height: 0.07,
      fontSize: 18,
    },
    completionDate: {
      ...baseText,
      visible: true,
      x: 0.08,
      y: 0.82,
      width: 0.3,
      height: 0.05,
      fontSize: 11,
      align: 'left',
    },
    certificateId: {
      ...baseText,
      visible: true,
      x: 0.62,
      y: 0.82,
      width: 0.3,
      height: 0.05,
      fontSize: 11,
      align: 'right',
    },
    duration: { ...baseText, x: 0.35, y: 0.6, width: 0.3, height: 0.05, fontSize: 12 },
    signatoryName1: {
      ...baseText,
      visible: true,
      x: 0.08,
      y: 0.72,
      width: 0.3,
      height: 0.05,
      fontSize: 13,
      fontWeight: 'bold',
    },
    signatoryDesignation1: {
      ...baseText,
      visible: true,
      x: 0.08,
      y: 0.76,
      width: 0.3,
      height: 0.04,
      fontSize: 10,
    },
    signatoryName2: {
      ...baseText,
      visible: true,
      x: 0.62,
      y: 0.72,
      width: 0.3,
      height: 0.05,
      fontSize: 13,
      fontWeight: 'bold',
    },
    signatoryDesignation2: {
      ...baseText,
      visible: true,
      x: 0.62,
      y: 0.76,
      width: 0.3,
      height: 0.04,
      fontSize: 10,
    },
    signature1: {
      visible: true,
      x: 0.1,
      y: 0.65,
      width: 0.2,
      height: 0.06,
      objectFit: 'contain',
      opacity: 1,
    },
    signature2: {
      visible: true,
      x: 0.7,
      y: 0.65,
      width: 0.2,
      height: 0.06,
      objectFit: 'contain',
      opacity: 1,
    },
    verificationQr: { visible: true, x: 0.44, y: 0.84, size: 0.1 },
  };
}

export function emptySignatory(): Signatory {
  return { name: '', designation: '', storagePath: null };
}

export function defaultSignatories(): Signatories {
  return { signature1: emptySignatory(), signature2: emptySignatory() };
}
