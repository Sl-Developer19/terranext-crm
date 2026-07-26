import { NextResponse, type NextRequest } from 'next/server';

import { AUTH_SECURITY } from '@/config/auth-security';
import { verifySessionCookieOnEdge } from '@/lib/auth/edge-session';
import { env } from '@/lib/env';

const SESSION_COOKIE_NAME = '__session';
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

// Growth Partner portal (Doc 25, ADR-014) — a fully separate cookie/session
// namespace from the staff app above, gated independently below.
const PARTNER_SESSION_COOKIE_NAME = AUTH_SECURITY.partnerSessionCookie.name;
const PARTNER_PUBLIC_PATHS = ['/partner/login'];

function isPartnerRoute(pathname: string): boolean {
  return pathname === '/partner' || pathname.startsWith('/partner/');
}

async function handlePartnerRoute(request: NextRequest, pathname: string): Promise<NextResponse> {
  const isPublic = PARTNER_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const sessionCookie = request.cookies.get(PARTNER_SESSION_COOKIE_NAME)?.value;
  const edgeSession = sessionCookie
    ? await verifySessionCookieOnEdge(sessionCookie, env().NEXT_PUBLIC_FIREBASE_PROJECT_ID)
    : null;
  const isPartner = edgeSession?.actorType === 'growth_partner';

  if (isPublic) {
    if (isPartner) {
      return NextResponse.redirect(new URL('/partner/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!isPartner) {
    const loginUrl = new URL('/partner/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (sessionCookie) response.cookies.delete(PARTNER_SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

/**
 * Route protection, layer 1 (Doc 05 §4): every application route requires a
 * cryptographically valid session cookie. Signature/expiry/issuer are checked
 * here; revocation and role authorization are checked server-side per request
 * (getSession / requirePermission / requirePartnerSession).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPartnerRoute(pathname)) {
    return handlePartnerRoute(request, pathname);
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie
    ? await verifySessionCookieOnEdge(sessionCookie, env().NEXT_PUBLIC_FIREBASE_PROJECT_ID)
    : null;

  // Signed-in users don't see the login screen
  if (isPublic) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear a present-but-invalid cookie so the browser doesn't loop
    if (sessionCookie) response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, static assets, and the
  // deliberately public endpoints: login (authenticates by password +
  // lockout policy), session DELETE (clears its own cookie), error reports
  // (must work before/without a session), certificate verification
  // (an employer checking a certificate has no CRM account — Doc 19 §1),
  // website lead intake and Growth Partner registration (a visitor on the
  // marketing site has no session either — both defend themselves with an
  // origin allow-list, honeypot, and rate limits instead, Doc 20 §2 /
  // Doc 25 §4), and the partner session DELETE (Doc 25, ADR-014 — same
  // "clears its own cookie" rationale as api/session).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/session|api/partner-session|api/auth|api/errors|api/certificates/verify|api/createLead|api/registerGrowthPartner|.*\\.(?:svg|png|jpg|ico)).*)',
  ],
};
