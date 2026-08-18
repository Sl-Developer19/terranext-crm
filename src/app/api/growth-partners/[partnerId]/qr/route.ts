import { NextResponse, type NextRequest } from 'next/server';

import { buildGrowthPartnerReferralUrl, getGrowthPartner } from '@/features/growth-partners';
import { getSession } from '@/lib/auth/session';
import { appOrigin } from '@/lib/http/app-origin';
import { renderQrPngBuffer, renderQrSvg } from '@/lib/qrcode';
import { can } from '@/lib/rbac/permissions';

/**
 * Staff-side QR viewing for an individual Growth Partner — hand-copied from
 * `/api/community-partners/[partnerId]/qr/route.ts` (same reasoning: reuses
 * the exact same `lib/qrcode` rendering so the image an admin previews here
 * is byte-identical to what the partner sees in their own portal, via
 * `buildGrowthPartnerReferralUrl` instead of Community Partners'
 * `buildReferralUrl`). This was the one piece `/partner/qr-code`'s original
 * header comment deferred as "a later feature" — now built for both kinds.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  if (!can(session.role, 'growthPartners:view')) return new NextResponse(null, { status: 403 });

  const { partnerId } = await params;
  const partner = await getGrowthPartner(partnerId);
  if (!partner || !partner.humanPartnerId) {
    return NextResponse.json(
      { ok: false, error: { code: 'not_found', message: 'QR code is not available yet.' } },
      { status: 404 },
    );
  }

  const origin = await appOrigin();
  const url = buildGrowthPartnerReferralUrl(origin, partner.humanPartnerId);
  const format = request.nextUrl.searchParams.get('format') === 'png' ? 'png' : 'svg';

  if (format === 'png') {
    const png = await renderQrPngBuffer(url);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${partner.humanPartnerId}-qr.png"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  const svg = await renderQrSvg(url);
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="${partner.humanPartnerId}-qr.svg"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
