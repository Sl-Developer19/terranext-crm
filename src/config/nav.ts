import {
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileBadge,
  GraduationCap,
  LayoutDashboard,
  Mail,
  MessageSquareText,
  Percent,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Module, Permission } from '@/lib/rbac/permissions';

/**
 * Navigation tree (Doc 05 §2). Each item's `permission` is checked against
 * the signed-in role's grants — the same ROLE_PERMISSIONS map that guards
 * routes and Firestore rules, so nav visibility can never promise access
 * the server would then deny.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const view = (module: Module): Permission => `${module}:view`;

export const NAV_GROUPS: NavGroup[] = [
  {
    label: '',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: view('dashboard'),
      },
    ],
  },
  {
    label: 'Acquisition',
    items: [
      { label: 'Leads', href: '/leads', icon: Sparkles, permission: view('leads') },
      {
        label: 'Counselling',
        href: '/counselling',
        icon: MessageSquareText,
        permission: view('counselling'),
      },
      {
        label: 'Admissions',
        href: '/admissions',
        icon: ClipboardList,
        permission: view('admissions'),
      },
      {
        label: 'Parents & Families',
        href: '/parents',
        icon: UsersRound,
        permission: view('parents'),
      },
      { label: 'Colleges', href: '/colleges', icon: Building2, permission: view('colleges') },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        label: 'Participants',
        href: '/participants',
        icon: Users,
        permission: view('participants'),
      },
      {
        label: 'Programmes',
        href: '/programmes',
        icon: GraduationCap,
        permission: view('programmes'),
      },
      { label: 'Batches', href: '/batches', icon: UsersRound, permission: view('batches') },
      {
        label: 'Attendance',
        href: '/attendance',
        icon: CalendarCheck,
        permission: view('attendance'),
      },
      {
        label: 'Assessments',
        href: '/assessments',
        icon: BadgeCheck,
        permission: view('assessments'),
      },
      {
        label: 'Certificates',
        href: '/certificates',
        icon: FileBadge,
        permission: view('certificates'),
      },
    ],
  },
  {
    label: 'Career',
    items: [
      { label: 'Career Interest', href: '/career', icon: Briefcase, permission: view('career') },
      { label: 'Placements', href: '/placements', icon: Percent, permission: view('placements') },
      { label: 'Employers', href: '/employers', icon: Building2, permission: view('employers') },
      { label: 'Alumni', href: '/alumni', icon: GraduationCap, permission: view('alumni') },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Fees & Collections', href: '/fees', icon: Banknote, permission: view('fees') },
      {
        label: 'Communications',
        href: '/communications',
        icon: Mail,
        permission: view('communications'),
      },
      { label: 'Reports', href: '/reports', icon: ClipboardList, permission: view('reports') },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', icon: UserCog, permission: view('users') },
      {
        label: 'Roles & Permissions',
        href: '/admin/roles',
        icon: ShieldCheck,
        permission: view('roles'),
      },
      {
        label: 'Audit Logs',
        href: '/admin/audit-logs',
        icon: ClipboardList,
        permission: view('audit'),
      },
      { label: 'Settings', href: '/admin/settings', icon: Settings, permission: view('settings') },
    ],
  },
];
