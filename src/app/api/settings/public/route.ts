import { NextResponse, type NextRequest } from 'next/server';

import { PUBLIC_INTAKE } from '@/config/public-intake';
import { getBrandingSettings, getGeneralSettings } from '@/features/settings';

/**
 * Public, read-only organisation + branding settings — lets the website
 * consume contact info, social links, and brand colours/logos from the
 * CRM's Settings instead of a hardcoded `site-config.ts`, so an admin
 * editing Settings shows up on the website with no code change or redeploy.
 *
 * Same CORS/unauthenticated posture as `/api/catalogue/academies`. GST and
 * PAN are deliberately never included here — they are internal business
 * records, not public marketing-site content, unlike everything else on
 * `settings/general`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && PUBLIC_INTAKE.allowedOrigins.includes(origin);
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function OPTIONS(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  if (origin && !PUBLIC_INTAKE.allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { ok: false, error: { code: 'permission', message: 'Origin not allowed.' } },
      { status: 403, headers },
    );
  }

  try {
    const [general, branding] = await Promise.all([getGeneralSettings(), getBrandingSettings()]);

    return NextResponse.json(
      {
        ok: true,
        data: {
          organization: {
            name: general.orgName,
            tagline: general.orgTagline,
            address: general.address,
            contactEmail: general.contactEmail,
            contactPhone: general.contactPhone,
            website: general.website,
            googleMapsUrl: general.googleMapsUrl,
            social: general.socialLinks,
          },
          branding: {
            primaryColor: branding.primaryColor,
            secondaryColor: branding.secondaryColor,
            accentColor: branding.accentColor,
            logoUrl: branding.logoUrl,
            faviconUrl: branding.faviconUrl,
            emailLogoUrl: branding.emailLogoUrl,
            certificateLogoUrl: branding.certificateLogoUrl,
            qrLogoUrl: branding.qrLogoUrl,
          },
        },
      },
      {
        status: 200,
        headers: {
          ...headers,
          // Same short-cache posture as the academies route — reflects an
          // admin's Settings change within minutes, not instantly.
          'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'internal', message: 'Could not load settings.' } },
      { status: 500, headers },
    );
  }
}
