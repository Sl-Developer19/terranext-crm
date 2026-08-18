import { PartnerShell } from '@/components/layout/partner-shell';
import { SignOutButton } from '@/features/auth';
import { requirePartnerSession } from '@/lib/rbac/require-partner';
import { getGrowthPartner } from '@/features/growth-partners';
import { getCommunityPartner } from '@/features/community-partners';

/**
 * Guarded partner-portal shell (Doc 25 §6, ADR-014; extended for TCGN) — the
 * partner counterpart to `(app)/layout.tsx`. `/partner/login` sits outside
 * this group (mirrors `(auth)` vs `(app)`) so the guard never blocks the
 * login page itself. Shared unmodified by both partner kinds — only the
 * profile lookup below branches on `session.partnerType` to resolve the
 * display name from the right collection.
 */
export default async function PartnerPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePartnerSession();

  const displayName =
    session.partnerType === 'community_business'
      ? ((await getCommunityPartner(session.partnerId))?.orgName ?? session.email ?? 'Partner')
      : ((await getGrowthPartner(session.partnerId))?.displayName ?? session.email ?? 'Partner');

  return (
    <PartnerShell
      displayName={displayName}
      headerActions={<SignOutButton endpoint="/api/partner-session" redirectTo="/partner/login" />}
    >
      {children}
    </PartnerShell>
  );
}
