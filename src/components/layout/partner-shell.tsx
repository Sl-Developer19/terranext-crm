'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type * as React from 'react';

import { Logo } from '@/components/ui/logo';
import { Badge } from '@/components/ui/badge';
import { siteConfig } from '@/config/site';
import { PARTNER_NAV_ITEMS } from '@/config/partner-nav';
import { cn } from '@/lib/utils/cn';

/**
 * Growth Partner portal frame (Doc 25 §6, ADR-014) — deliberately not
 * `AppShell`: that component is typed to the staff `Session`/`StaffRole` and
 * filters `NAV_GROUPS` through `can()`, neither of which applies to a
 * partner. This reuses the same visual language (same classNames, `Logo`,
 * `Badge`, sticky topbar) rather than the same component, exactly as
 * ADR-014 keeps `isPartner()` parallel to `isStaff()` at the rules layer.
 */
export function PartnerShell({
  displayName,
  headerActions,
  children,
}: {
  displayName: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-premium-lg"
      >
        Skip to main content
      </a>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Logo size="sm" />
        </div>
        <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Growth Partner
          </p>
          <ul className="space-y-0.5">
            {PARTNER_NAV_ITEMS.map((item) => {
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
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <div className="card-sheen flex items-center gap-2.5 rounded-lg border border-gold/15 bg-gradient-to-br from-gold/[0.06] to-emerald/[0.06] px-3 py-2.5">
            <Logo size="sm" wordmark={false} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium text-foreground">{siteConfig.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">Partner Portal</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <span className="text-sm font-medium text-foreground md:hidden">{siteConfig.name}</span>
          <div className="ml-auto flex items-center gap-3">
            {headerActions}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <Badge variant="gold" className="mt-0.5">
                  Growth Partner
                </Badge>
              </div>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
