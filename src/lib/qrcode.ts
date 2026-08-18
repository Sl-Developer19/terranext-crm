import 'server-only';

import QRCode from 'qrcode';

/**
 * Generic QR rendering (Doc 02 §4 — `lib` owns capabilities, never feature
 * meaning). This module knows nothing about partners, referrals, or TCGN —
 * it turns arbitrary text into an image and nothing else, so any future
 * feature that needs a QR code (any partner programme, a certificate,
 * anything) reuses this instead of pulling in the `qrcode` package again.
 */

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 2,
};

/** Renders a scalable SVG markup string — best for print (crisp at any size). */
export async function renderQrSvg(data: string): Promise<string> {
  return QRCode.toString(data, { ...QR_OPTIONS, type: 'svg' });
}

/** Renders a PNG buffer at a fixed pixel size — best for general download/embedding. */
export async function renderQrPngBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { ...QR_OPTIONS, type: 'png', width: 512 });
}
