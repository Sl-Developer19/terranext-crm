import { NextResponse, type NextRequest } from 'next/server';

import { findAcademies } from '@/features/catalogue/repository';
import { PUBLIC_INTAKE } from '@/config/public-intake';

/**
 * Public, read-only academy list — lets the website's Apply form and
 * enquiry popup populate their academy dropdown from the CRM's catalogue
 * instead of a hardcoded array, so a new/renamed/reordered academy in
 * Settings shows up on the website with no code change or redeploy.
 *
 * Same CORS posture as `/api/createLead` (Doc 20 §2): only the configured
 * website origins may fetch cross-origin; a server-to-server or curl caller
 * with no Origin header stays allowed. This route is unauthenticated by
 * design — it's public marketing-site content, not privileged data — and
 * returns only what's safe to expose publicly: name, slug, description,
 * display order. No internal IDs, audit fields, or archived academies.
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
    const academies = await findAcademies();
    const publicAcademies = academies
      .filter((academy) => academy.status === 'active')
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((academy) => ({
        name: academy.name,
        slug: academy.slug,
        description: academy.description,
        icon: academy.icon,
        themeColor: academy.themeColor,
      }));

    return NextResponse.json(
      { ok: true, data: publicAcademies },
      {
        status: 200,
        headers: {
          ...headers,
          // Short cache — the catalogue changes rarely, but a Founder editing
          // Settings should see it reflected on the website within minutes,
          // not require a manual cache bust.
          'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'internal', message: 'Could not load academies.' } },
      { status: 500, headers },
    );
  }
}
