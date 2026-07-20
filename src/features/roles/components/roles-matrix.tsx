'use client';

import { STAFF_ROLES } from '@/types/common';

import type { RoleMatrixRow } from '../schema';
import type { Action, StaffRole } from '../schema';

/** Labels for the column headers (Doc 04 §1 role display names). */
const ROLE_LABELS: Record<StaffRole, string> = {
  founder: 'Founder',
  system_admin: 'Sys Admin',
  ops_manager: 'Ops Mgr',
  consultant: 'Consultant',
  coordinator: 'Coordinator',
  trainer: 'Trainer',
  finance: 'Finance',
  placement: 'Placement',
};

const ACTION_ABBREV: Record<Action, string> = {
  view: 'V',
  create: 'C',
  update: 'U',
  delete: 'D',
  assign: 'A',
  approve: 'P',
  export: 'E',
  configure: 'G',
};

const ACTION_LABEL: Record<Action, string> = {
  view: 'view',
  create: 'create',
  update: 'update',
  delete: 'delete (soft)',
  assign: 'assign',
  approve: 'approve',
  export: 'export',
  configure: 'configure',
};

function ActionPill({ action }: { action: Action }) {
  const colours: Record<Action, string> = {
    view: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    create: 'bg-green-500/15 text-green-700 dark:text-green-300',
    update: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    delete: 'bg-red-500/15 text-red-700 dark:text-red-300',
    assign: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    approve: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    export: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    configure: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  };
  return (
    <abbr
      title={ACTION_LABEL[action]}
      className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold no-underline ${colours[action]}`}
    >
      {ACTION_ABBREV[action]}
    </abbr>
  );
}

export function RolesMatrix({ rows, version }: { rows: RoleMatrixRow[]; version: string }) {
  return (
    <div className="overflow-x-auto">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs font-medium text-muted-foreground">Legend:</span>
        {(Object.entries(ACTION_ABBREV) as [Action, string][]).map(([action]) => (
          <span key={action} className="flex items-center gap-1 text-xs text-muted-foreground">
            <ActionPill action={action} />
            <span>{ACTION_LABEL[action]}</span>
          </span>
        ))}
      </div>

      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">
              Module
            </th>
            {STAFF_ROLES.map((role) => (
              <th
                key={role}
                className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {ROLE_LABELS[role]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.module} className="border-b transition-colors hover:bg-muted/30">
              <td className="py-2 pr-4">
                <code className="font-mono text-xs text-foreground">{row.module}</code>
              </td>
              {STAFF_ROLES.map((role) => {
                const actions = row.cells[role] ?? [];
                return (
                  <td key={role} className="px-2 py-2 text-center">
                    {actions.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-0.5">
                        {actions.map((action) => (
                          <ActionPill key={action} action={action} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 px-1 text-right text-[11px] text-muted-foreground">
        Map version: <code className="font-mono">{version}</code> · Changes require a PR to{' '}
        <code className="font-mono">lib/rbac/permissions.ts</code> (ADR-011)
      </p>
    </div>
  );
}
