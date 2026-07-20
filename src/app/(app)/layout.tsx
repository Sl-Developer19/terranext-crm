import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/app-shell';
import { SignOutButton } from '@/features/auth';
import { getSession } from '@/lib/auth/session';

/**
 * Authenticated shell (Doc 05 §4 layer 2). Middleware already guarantees a
 * syntactically valid cookie; this layer loads the authoritative session
 * once per request and renders the role-scoped shell around every page.
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <AppShell session={session} headerActions={<SignOutButton />}>
      {children}
    </AppShell>
  );
}
