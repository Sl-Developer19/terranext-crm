import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignOutButton } from '@/features/auth';
import { getSession } from '@/lib/auth/session';
import { visibleModules } from '@/lib/rbac/permissions';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Minimal authenticated landing proving the full auth chain
 * (cookie → verification → role claim → RBAC read). Replaced by the
 * role-scoped widget dashboard when the app shell lands (Doc 16 S03).
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login'); // defense in depth behind middleware

  const modules = visibleModules(session.role);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {session.email ?? session.uid} ·{' '}
            <span className="font-mono text-xs">{session.role}</span>
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-sm font-medium">Your modules</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Navigation scoped to the <span className="font-mono">{session.role}</span> role (Doc 04
          matrix). The full application shell arrives next in Milestone 1.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {modules.map((m) => (
            <li key={m} className="rounded-md bg-muted px-3 py-2 capitalize">
              {m}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
