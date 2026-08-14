import { describe, expect, it } from 'vitest';

import {
  ARTWORK_MAX_BYTES,
  createTemplateSchema,
  imageFieldConfigSchema,
  qrFieldConfigSchema,
  requestArtworkUploadSchema,
  textFieldConfigSchema,
} from './schema';
import { defaultTemplateFields } from './logic';

/** Certificate Template Engine — Zod schema boundary checks. */

describe('createTemplateSchema', () => {
  it('requires at least an academy or a programme', () => {
    const result = createTemplateSchema.safeParse({
      name: 'NextGen Classic',
      description: '',
      academyId: null,
      programmeId: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a programme-only assignment', () => {
    const result = createTemplateSchema.safeParse({
      name: 'NextGen Classic',
      description: '',
      academyId: null,
      programmeId: 'prog1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an academy-only fallback assignment', () => {
    const result = createTemplateSchema.safeParse({
      name: 'Academy Default',
      description: '',
      academyId: 'academy1',
      programmeId: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a blank name', () => {
    const result = createTemplateSchema.safeParse({
      name: '',
      description: '',
      academyId: 'academy1',
      programmeId: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('textFieldConfigSchema', () => {
  it('accepts a well-formed field from the default set', () => {
    const result = textFieldConfigSchema.safeParse(defaultTemplateFields().participantName);
    expect(result.success).toBe(true);
  });

  it('rejects coordinates outside the 0–1 unit range', () => {
    const result = textFieldConfigSchema.safeParse({
      ...defaultTemplateFields().participantName,
      x: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown font family', () => {
    const result = textFieldConfigSchema.safeParse({
      ...defaultTemplateFields().participantName,
      fontFamily: 'ComicSans',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed colour', () => {
    const result = textFieldConfigSchema.safeParse({
      ...defaultTemplateFields().participantName,
      color: 'red',
    });
    expect(result.success).toBe(false);
  });
});

describe('imageFieldConfigSchema', () => {
  it('rejects opacity outside 0–1', () => {
    const result = imageFieldConfigSchema.safeParse({
      ...defaultTemplateFields().signature1,
      opacity: 1.2,
    });
    expect(result.success).toBe(false);
  });
});

describe('qrFieldConfigSchema', () => {
  it('accepts the default QR field', () => {
    const result = qrFieldConfigSchema.safeParse(defaultTemplateFields().verificationQr);
    expect(result.success).toBe(true);
  });
});

describe('requestArtworkUploadSchema', () => {
  it('rejects a file over the size cap', () => {
    const result = requestArtworkUploadSchema.safeParse({
      templateId: 't1',
      versionId: 'v1',
      fileName: 'certificate.png',
      contentType: 'image/png',
      sizeBytes: ARTWORK_MAX_BYTES + 1,
      widthPx: 3000,
      heightPx: 2100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a disallowed content type', () => {
    const result = requestArtworkUploadSchema.safeParse({
      templateId: 't1',
      versionId: 'v1',
      fileName: 'certificate.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1000,
      widthPx: 3000,
      heightPx: 2100,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a within-limits PNG upload request', () => {
    const result = requestArtworkUploadSchema.safeParse({
      templateId: 't1',
      versionId: 'v1',
      fileName: 'certificate.png',
      contentType: 'image/png',
      sizeBytes: 1_000_000,
      widthPx: 3000,
      heightPx: 2100,
    });
    expect(result.success).toBe(true);
  });
});
