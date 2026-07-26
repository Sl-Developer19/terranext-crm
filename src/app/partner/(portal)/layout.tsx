import { PartnerShell } from '@/components/layout/partner-shell';
import { SignOutButton } from '@/features/auth';
import { requirePartnerSession } from '@/lib/rbac/require-partner';
import { getGrowthPartner } from '@/features/growth-partners';

/**
 * Guarded partner-portal shell (Doc 25 §6, ADR-014) — the partner
 * counterpart to `(app)/layout.tsx`. `/partner/login` sits outside this
 * group (mirrors `(auth)` vs `(app)`) so the guard never blocks the login
 * page itself.
 */
export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePartnerSession();
  const partner = await getGrowthPartner(session.partnerId);

  return (
    <PartnerShell
      displayName={partner?.displayName ?? session.email ?? 'Partner'}
      headerActions={<SignOutButton endpoint="/api/partner-session" redirectTo="/partner/login" />}
    >
      {children}
    </PartnerShell>
  );
}
