import { describe, expect, it } from 'vitest';

import {
  ASSUMED_ARTWORK_DPI,
  artworkPageSizePt,
  canActivate,
  canApprove,
  canArchive,
  canEditVersion,
  canSubmitForReview,
  defaultSignatories,
  defaultTemplateFields,
  emptySignatory,
  validateForActivation,
} from './logic';
import type { ArtworkMeta, Signatories, TemplateFields } from './schema';

/** Certificate Template Engine — pure logic (status transitions, activation gate, geometry). */

const ARTWORK: ArtworkMeta = {
  storagePath: 'certificateTemplates/t1/v1/artwork.png',
  mimeType: 'image/png',
  widthPx: 3000,
  heightPx: 2100,
  sizeBytes: 1_000_000,
};

function completeSignatories(): Signatories {
  return {
    signature1: { name: 'Prabu', designation: 'Director', storagePath: 'sig1.png' },
    signature2: { name: 'Sujitha', designation: 'Programme Head', storagePath: 'sig2.png' },
  };
}

describe('status transition gates', () => {
  it('only a draft can be edited or submitted', () => {
    expect(canEditVersion('draft')).toBe(true);
    expect(canSubmitForReview('draft')).toBe(true);
    for (const status of ['review', 'approved', 'active', 'archived'] as const) {
      expect(canEditVersion(status)).toBe(false);
      expect(canSubmitForReview(status)).toBe(false);
    }
  });

  it('only a version in review can be approved', () => {
    expect(canApprove('review')).toBe(true);
    for (const status of ['draft', 'approved', 'active', 'archived'] as const) {
      expect(canApprove(status)).toBe(false);
    }
  });

  it('only an approved version can be activated', () => {
    expect(canActivate('approved')).toBe(true);
    for (const status of ['draft', 'review', 'active', 'archived'] as const) {
      expect(canActivate(status)).toBe(false);
    }
  });

  it('anything not already archived can be archived, including an active version', () => {
    for (const status of ['draft', 'review', 'approved', 'active'] as const) {
      expect(canArchive(status)).toBe(true);
    }
    expect(canArchive('archived')).toBe(false);
  });
});

describe('validateForActivation', () => {
  it('requires artwork', () => {
    const result = validateForActivation({
      artwork: null,
      fields: defaultTemplateFields(),
      signatories: completeSignatories(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('artwork'))).toBe(true);
  });

  it('requires participant name, completion date, certificate ID, and QR to be visible', () => {
    const fields: TemplateFields = {
      ...defaultTemplateFields(),
      participantName: { ...defaultTemplateFields().participantName, visible: false },
      completionDate: { ...defaultTemplateFields().completionDate, visible: false },
      certificateId: { ...defaultTemplateFields().certificateId, visible: false },
      verificationQr: { ...defaultTemplateFields().verificationQr, visible: false },
    };
    const result = validateForActivation({
      artwork: ARTWORK,
      fields,
      signatories: completeSignatories(),
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(4);
  });

  it('requires a complete signatory (name, designation, image) when a signature field is visible', () => {
    const fields: TemplateFields = {
      ...defaultTemplateFields(),
      signature1: { ...defaultTemplateFields().signature1, visible: true },
    };
    const result = validateForActivation({
      artwork: ARTWORK,
      fields,
      signatories: { signature1: emptySignatory(), signature2: emptySignatory() },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Signature 1'))).toBe(true);
  });

  it('does not require a signatory for a signature field that is hidden', () => {
    const fields: TemplateFields = {
      ...defaultTemplateFields(),
      signature1: { ...defaultTemplateFields().signature1, visible: false },
      signature2: { ...defaultTemplateFields().signature2, visible: false },
    };
    const result = validateForActivation({
      artwork: ARTWORK,
      fields,
      signatories: defaultSignatories(),
    });
    expect(result.ok).toBe(true);
  });

  it('passes when artwork, required fields, and signatories are all in place', () => {
    const result = validateForActivation({
      artwork: ARTWORK,
      fields: defaultTemplateFields(),
      signatories: completeSignatories(),
    });
    expect(result).toEqual({ ok: true, errors: [] });
  });
});

describe('artworkPageSizePt', () => {
  it('preserves the artwork aspect ratio exactly', () => {
    const { widthPt, heightPt } = artworkPageSizePt(3000, 2100);
    expect(widthPt / heightPt).toBeCloseTo(3000 / 2100, 10);
  });

  it('derives page size from the assumed print DPI', () => {
    const { widthPt, heightPt } = artworkPageSizePt(1500, 1050);
    expect(widthPt).toBeCloseTo((1500 / ASSUMED_ARTWORK_DPI) * 72, 6);
    expect(heightPt).toBeCloseTo((1050 / ASSUMED_ARTWORK_DPI) * 72, 6);
  });

  it('never stretches or distorts — a square artwork stays a square page', () => {
    const { widthPt, heightPt } = artworkPageSizePt(2000, 2000);
    expect(widthPt).toBeCloseTo(heightPt, 10);
  });
});

describe('default factories', () => {
  it('produces a draft-ready field set with the required fields already visible', () => {
    const fields = defaultTemplateFields();
    expect(fields.participantName.visible).toBe(true);
    expect(fields.completionDate.visible).toBe(true);
    expect(fields.certificateId.visible).toBe(true);
    expect(fields.verificationQr.visible).toBe(true);
  });

  it('produces empty signatories with no storage path', () => {
    const signatories = defaultSignatories();
    expect(signatories.signature1.storagePath).toBeNull();
    expect(signatories.signature2.storagePath).toBeNull();
  });
});
