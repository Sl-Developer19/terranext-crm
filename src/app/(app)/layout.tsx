import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { IdleTimeoutProvider } from '@/components/providers/idle-timeout-provider';
import { IdleLockGate, SignOutButton } from '@/features/auth';
import { getSession } from '@/lib/auth/session';

/**
 * Authenticated shell (Doc 05 §4 layer 2). Middleware already guarantees a
 * syntactically valid cookie; this layer loads the authoritative session
 * once per request and renders the role-scoped shell around every page.
 *
 * IdleTimeoutProvider/IdleLockGate (M1-B) are mounted here, not inside
 * AppShell: composing a `providers` timer with a `features` modal requires
 * an import boundary only the `app` layer is allowed to cross (Doc 02 §5).
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <IdleTimeoutProvider role={session.role} />
      <IdleLockGate email={session.email} />
      <AppShell session={session} headerActions={<SignOutButton />}>
        {children}
      </AppShell>
    </>
  );
}
