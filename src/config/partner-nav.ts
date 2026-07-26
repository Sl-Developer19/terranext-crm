import { Bell, LayoutDashboard, Percent, Sparkles, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Growth Partner portal nav (Doc 25 §6). Unlike `config/nav.ts`, there is no
 * permission filter — every Growth Partner has the same fixed capability
 * set, so this list is simply the complete portal, extended as each
 * partner-facing screen lands.
 */
export interface PartnerNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const PARTNER_NAV_ITEMS: PartnerNavItem[] = [
  { label: 'Dashboard', href: '/partner/dashboard', icon: LayoutDashboard },
  { label: 'My Leads', href: '/partner/leads', icon: Sparkles },
  { label: 'My Rewards', href: '/partner/rewards', icon: Percent },
  { label: 'Notifications', href: '/partner/notifications', icon: Bell },
  { label: 'Profile', href: '/partner/profile', icon: UserRound },
];
