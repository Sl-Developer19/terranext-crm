import { NextResponse, type NextRequest } from 'next/server';

import { buildReferralUrl, getCommunityPartner } from '@/features/community-partners';
import { buildGrowthPartnerReferralUrl, getGrowthPartner } from '@/features/growth-partners';
import { getPartnerSession } from '@/lib/auth/partner-session';
import { appOrigin } from '@/lib/http/app-origin';
import { renderQrPngBuffer, renderQrSvg } from '@/lib/qrcode';

/**
 * QR Generation + Download (TCGN, Feature 6; extended to individual Growth
 * Partners) — self-service: a partner downloads their own QR, nothing else.
 * Lives under `/partner/` so it rides the existing `/partner/*` middleware
 * branch unchanged (a valid partner session is already required to reach
 * this route at all); the `getPartnerSession()` call below is
 * defense-in-depth (Doc 04 §4 pattern), not the only gate.
 *
 * Dispatches on `session.partnerType` (`lib/auth/partner-directory.ts`'s
 * mapping) rather than assuming Community Partner — a Growth Partner's own
 * `humanPartnerId`/`buildGrowthPartnerReferralUrl` are used identically, just
 * from the other collection.
 *
 * Staff-side QR viewing (an admin pulling a partner's QR for them) is
 * intentionally out of scope here — that belongs with the Admin Management
 * screens (a later feature), not this partner-facing endpoint.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getPartnerSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const origin = await appOrigin();

  const resolved =
    session.partnerType === 'community_business'
      ? await getCommunityPartner(session.partnerId).then((partner) =>
          partner?.humanPartnerId
            ? {
                humanPartnerId: partner.humanPartnerId,
                url: buildReferralUrl(origin, partner.humanPartnerId),
              }
            : null,
        )
      : await getGrowthPartner(session.partnerId).then((partner) =>
          partner?.humanPartnerId
            ? {
                humanPartnerId: partner.humanPartnerId,
                url: buildGrowthPartnerReferralUrl(origin, partner.humanPartnerId),
              }
            : null,
        );

  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'not_found', message: 'Your QR code is not available yet.' },
      },
      { status: 404 },
    );
  }

  const format = request.nextUrl.searchParams.get('format') === 'png' ? 'png' : 'svg';

  if (format === 'png') {
    const png = await renderQrPngBuffer(resolved.url);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${resolved.humanPartnerId}-qr.png"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  const svg = await renderQrSvg(resolved.url);
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': `attachment; filename="${resolved.humanPartnerId}-qr.svg"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
