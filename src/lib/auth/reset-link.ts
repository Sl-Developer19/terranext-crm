import 'server-only';

import { adminAuth } from '@/lib/firebase/admin';

/**
 * Shared by the password-reset request flow and staff provisioning (Doc 10
 * §1 extension): both need a link back to our own branded `/reset-password`
 * page rather than Firebase's default hosted action handler.
 *
 * Admin SDK, not the public REST `sendOobCode`: this returns the link
 * without triggering Firebase's own hosted email, so the caller can send its
 * own branded one instead.
 */
export async function generateBrandedResetLink(
  email: string,
  appOrigin: string,
): Promise<string | null> {
  let link: string;
  try {
    link = await adminAuth().generatePasswordResetLink(email);
  } catch (error) {
    // "no account for this email" is the expected shape for the
    // forgot-password flow (the caller treats null as "do nothing" —
    // enumeration resistance holds either way); anything else is logged for
    // ops but still yields no link.
    if ((error as { code?: string }).code !== 'auth/user-not-found') {
      console.error('generatePasswordResetLink failed', error);
    }
    return null;
  }
  const oobCode = new URL(link).searchParams.get('oobCode');
  return oobCode ? `${appOrigin}/reset-password?oobCode=${encodeURIComponent(oobCode)}` : null;
}
