import { NextResponse, type NextRequest } from 'next/server';

import { MFA_REQUIRED_ROLES } from '@/config/auth-security';
import { verifySessionCookieOnEdge } from '@/lib/auth/edge-session';
import { env } from '@/lib/env';

const SESSION_COOKIE_NAME = '__session';
const PUBLIC_PATHS = ['/login', '/mfa-enroll'];

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

  // Signed-in users don't see the login screen (unless enrolling MFA)
  if (isPublic) {
    if (session) {
      if (pathname === '/mfa-enroll') {
        return NextResponse.next();
      }
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

  // MFA enforcement check (Doc 10 §1): high-privilege roles without mfaEnrolled claim must enroll first.
  if (
    session.role &&
    (MFA_REQUIRED_ROLES as readonly string[]).includes(session.role) &&
    !session.mfaEnrolled &&
    pathname !== '/mfa-enroll'
  ) {
    return NextResponse.redirect(new URL('/mfa-enroll', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, static assets, and the auth /
  // error-report endpoints (login authenticates by password + lockout
  // policy, session DELETE clears its own cookie, error reports must work
  // even without — or before — a valid session; none require the cookie
  // this middleware enforces).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/session|api/auth|api/errors|.*\\.(?:svg|png|jpg|ico)).*)',
  ],
};
