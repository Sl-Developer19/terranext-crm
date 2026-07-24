'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { NAV_GROUPS } from '@/config/nav';
import { can } from '@/lib/rbac/permissions';
import { cn } from '@/lib/utils/cn';
import type { StaffRole } from '@/types/common';

/**
 * Role-scoped nav (Doc 05 §1). Filters NAV_GROUPS client-side against
 * `role` — a plain string is the only thing crossing the server/client
 * boundary (icon components from NAV_GROUPS are not serializable props;
 * they must be resolved inside the client component that owns them,
 * not passed in from the server AppShell). `can()` is the same pure,
 * framework-free check used server-side (Doc 04 §4) — this is UX only,
 * never the enforcement point; routes are guarded independently.
 */
export function Sidebar({ role }: { role: StaffRole }) {
  const pathname = usePathname();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(role, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav aria-label="Primary" className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((group, i) => (
        <div key={group.label || i}>
          {group.label ? (
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150',
                      active
                        ? 'bg-gold/10 font-medium text-gold-hover'
                        : 'text-foreground-secondary hover:translate-x-0.5 hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-gold transition-opacity',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <Icon
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        active ? 'text-gold' : 'text-muted-foreground group-hover:text-gold',
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
