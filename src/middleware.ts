import { NextResponse, type NextRequest } from 'next/server';

import { verifySessionCookieOnEdge } from '@/lib/auth/edge-session';
import { env } from '@/lib/env';

const SESSION_COOKIE_NAME = '__session';
const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

/**
 * Route protection, layer 1 (Doc 05 §4): every application route requires a
 * cryptographically valid session cookie. Signature/expiry/issuer are checked
 * here; revocation and role authorization are checked server-side per request
 * (getSession / requirePermission).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
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
  // and website lead intake (a visitor on the marketing site has no session
  // either — createLead defends itself with an origin allow-list, honeypot
  // and rate limits instead, Doc 20 §2).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/session|api/auth|api/errors|api/certificates/verify|api/createLead|.*\\.(?:svg|png|jpg|ico)).*)',
  ],
};
