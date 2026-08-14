import 'server-only';

import {
  PDFDocument,
  StandardFonts,
  clip,
  closePath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';

import { artworkPageSizePt } from './logic';
import {
  TEXT_FIELD_KEYS,
  type ImageFieldConfig,
  type QrFieldConfig,
  type TemplateFields,
  type TemplateFontFamily,
  type TextFieldConfig,
  type TextFieldKey,
} from './schema';

/**
 * Certificate PDF rendering — the one and only PDF engine in this codebase
 * (none existed before the Template Engine). Uploaded artwork is embedded at
 * its own pixel resolution/aspect ratio as page background, never redrawn,
 * never distorted; dynamic fields are placed on top purely from the
 * template version's own stored coordinates (0–1 fractions of the artwork).
 * Nothing here hardcodes a layout for any specific certificate design.
 */

const FONT_MAP: Record<TemplateFontFamily, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  'Helvetica-Oblique': StandardFonts.HelveticaOblique,
  TimesRoman: StandardFonts.TimesRoman,
  TimesRomanBold: StandardFonts.TimesRomanBold,
  TimesRomanItalic: StandardFonts.TimesRomanItalic,
  Courier: StandardFonts.Courier,
  CourierBold: StandardFonts.CourierBold,
};

export interface CertificateRenderData {
  participantName: string;
  programmeName: string;
  academyName: string;
  completionDate: string;
  certificateId: string;
  duration: string;
  signatoryName1: string;
  signatoryDesignation1: string;
  signatoryName2: string;
  signatoryDesignation2: string;
}

export interface CertificateRenderAssets {
  artworkBytes: Buffer;
  artworkMimeType: 'image/png' | 'image/jpeg';
  artworkWidthPx: number;
  artworkHeightPx: number;
  signature1Bytes: Buffer | null;
  signature2Bytes: Buffer | null;
  qrPngBytes: Buffer;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

function textWidth(font: PDFFont, text: string, fontSize: number, letterSpacing: number): number {
  if (letterSpacing === 0) return font.widthOfTextAtSize(text, fontSize);
  const chars = [...text];
  let width = 0;
  for (const ch of chars) width += font.widthOfTextAtSize(ch, fontSize) + letterSpacing;
  return chars.length > 0 ? width - letterSpacing : 0;
}

function drawTextWithSpacing(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  letterSpacing: number,
  color: { r: number; g: number; b: number },
): void {
  if (letterSpacing === 0) {
    page.drawText(text, { x, y, size: fontSize, font, color: rgb(color.r, color.g, color.b) });
    return;
  }
  let cursor = x;
  for (const ch of text) {
    page.drawText(ch, {
      x: cursor,
      y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    });
    cursor += font.widthOfTextAtSize(ch, fontSize) + letterSpacing;
  }
}

function drawTextField(
  page: PDFPage,
  font: PDFFont,
  cfg: TextFieldConfig,
  value: string,
  pageWidthPt: number,
  pageHeightPt: number,
): void {
  const boxLeft = cfg.x * pageWidthPt;
  const boxTop = pageHeightPt - cfg.y * pageHeightPt;
  const boxWidth = cfg.width * pageWidthPt;
  const boxHeight = cfg.height * pageHeightPt;

  const color = hexToRgb(cfg.color);
  const width = textWidth(font, value, cfg.fontSize, cfg.letterSpacing);

  let x = boxLeft;
  if (cfg.align === 'center') x = boxLeft + (boxWidth - width) / 2;
  else if (cfg.align === 'right') x = boxLeft + boxWidth - width;

  // Vertically centered in the box using a cap-height approximation — good
  // enough for single-line certificate fields, and fully adjustable by the
  // admin via the field's own y/height, same as every other property here.
  const y = boxTop - boxHeight / 2 - cfg.fontSize * 0.32 * cfg.lineHeight;

  drawTextWithSpacing(page, font, value, x, y, cfg.fontSize, cfg.letterSpacing, color);
}

async function drawImageField(
  pdf: PDFDocument,
  page: PDFPage,
  cfg: ImageFieldConfig,
  image: PDFImage,
  pageWidthPt: number,
  pageHeightPt: number,
): Promise<void> {
  const boxLeft = cfg.x * pageWidthPt;
  const boxTop = pageHeightPt - cfg.y * pageHeightPt;
  const boxWidth = cfg.width * pageWidthPt;
  const boxHeight = cfg.height * pageHeightPt;
  const boxBottom = boxTop - boxHeight;

  const imgAspect = image.width / image.height;
  const boxAspect = boxWidth / boxHeight;

  let drawWidth: number;
  let drawHeight: number;
  if (cfg.objectFit === 'contain') {
    if (imgAspect > boxAspect) {
      drawWidth = boxWidth;
      drawHeight = boxWidth / imgAspect;
    } else {
      drawHeight = boxHeight;
      drawWidth = boxHeight * imgAspect;
    }
  } else {
    // cover: scale to fill the box, clipped to its bounds below.
    if (imgAspect > boxAspect) {
      drawHeight = boxHeight;
      drawWidth = boxHeight * imgAspect;
    } else {
      drawWidth = boxWidth;
      drawHeight = boxWidth / imgAspect;
    }
  }

  const drawX = boxLeft + (boxWidth - drawWidth) / 2;
  const drawY = boxBottom + (boxHeight - drawHeight) / 2;

  page.pushOperators(
    pushGraphicsState(),
    rectangle(boxLeft, boxBottom, boxWidth, boxHeight),
    clip(),
    closePath(),
  );
  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
    opacity: cfg.opacity,
  });
  page.pushOperators(popGraphicsState());
}

function drawQrField(
  page: PDFPage,
  cfg: QrFieldConfig,
  qrImage: PDFImage,
  pageWidthPt: number,
  pageHeightPt: number,
): void {
  const size = cfg.size * pageWidthPt;
  const x = cfg.x * pageWidthPt;
  const y = pageHeightPt - cfg.y * pageHeightPt - size;
  page.drawImage(qrImage, { x, y, width: size, height: size });
}

/**
 * Renders one certificate PDF from a template version's field configuration
 * plus the resolved participant/certificate data and pre-fetched image
 * assets (artwork, signatures, QR). Returns the PDF as raw bytes — callers
 * decide what to do with them (upload to Storage, stream to the client).
 */
export async function renderCertificatePdf(
  fields: TemplateFields,
  data: CertificateRenderData,
  assets: CertificateRenderAssets,
): Promise<Buffer> {
  const { widthPt, heightPt } = artworkPageSizePt(assets.artworkWidthPx, assets.artworkHeightPx);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([widthPt, heightPt]);

  const background =
    assets.artworkMimeType === 'image/png'
      ? await pdf.embedPng(assets.artworkBytes)
      : await pdf.embedJpg(assets.artworkBytes);
  page.drawImage(background, { x: 0, y: 0, width: widthPt, height: heightPt });

  const fontCache = new Map<TemplateFontFamily, PDFFont>();
  const getFont = async (family: TemplateFontFamily): Promise<PDFFont> => {
    const cached = fontCache.get(family);
    if (cached) return cached;
    const font = await pdf.embedFont(FONT_MAP[family]);
    fontCache.set(family, font);
    return font;
  };

  const textValues: Record<TextFieldKey, string> = {
    participantName: data.participantName,
    programmeName: data.programmeName,
    academyName: data.academyName,
    completionDate: data.completionDate,
    certificateId: data.certificateId,
    duration: data.duration,
    signatoryName1: data.signatoryName1,
    signatoryDesignation1: data.signatoryDesignation1,
    signatoryName2: data.signatoryName2,
    signatoryDesignation2: data.signatoryDesignation2,
  };

  for (const key of TEXT_FIELD_KEYS) {
    const cfg = fields[key];
    if (!cfg.visible) continue;
    const value = textValues[key];
    if (!value) continue;
    const font = await getFont(cfg.fontFamily);
    drawTextField(page, font, cfg, value, widthPt, heightPt);
  }

  if (fields.signature1.visible && assets.signature1Bytes) {
    const image = await embedImage(pdf, assets.signature1Bytes);
    if (image) await drawImageField(pdf, page, fields.signature1, image, widthPt, heightPt);
  }
  if (fields.signature2.visible && assets.signature2Bytes) {
    const image = await embedImage(pdf, assets.signature2Bytes);
    if (image) await drawImageField(pdf, page, fields.signature2, image, widthPt, heightPt);
  }
  if (fields.verificationQr.visible) {
    const qrImage = await pdf.embedPng(assets.qrPngBytes);
    drawQrField(page, fields.verificationQr, qrImage, widthPt, heightPt);
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

/** Signature uploads may be PNG or JPEG — sniff the format from magic bytes rather than trusting a stored field alone. */
async function embedImage(pdf: PDFDocument, bytes: Buffer): Promise<PDFImage | null> {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  try {
    return isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}
