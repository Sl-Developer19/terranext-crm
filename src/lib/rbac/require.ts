import 'server-only';

import { redirect } from 'next/navigation';

import { getSession, type Session } from '@/lib/auth/session';

import { can, type Permission } from './permissions';

/**
 * Route-level guard (Doc 05 §4 layer 3). Renders a 403, never a silent
 * redirect, so staff understand scoping (Doc 05 §4) — the caller is
 * responsible for rendering `<NoAccess permission={permission} />` when this
 * throws, which app/(app)/not-authorized does via redirect below.
 *
 * Usage at the top of a server page component:
 *   const session = await requirePermission('users:view');
 */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!can(session.role, permission)) {
    redirect(`/not-authorized?permission=${encodeURIComponent(permission)}`);
  }
  return session;
}

/** Non-redirecting check for conditional rendering inside an already-guarded page. */
export async function sessionCan(permission: Permission): Promise<boolean> {
  const session = await getSession();
  return session !== null && can(session.role, permission);
}
