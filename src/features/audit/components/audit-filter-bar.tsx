'use client';

import { useState } from 'react';

import { AUDIT_ACTIONS } from '@/lib/audit/types';

import type { AuditLogFilters } from '../schema';
import { REGISTER_PRESETS } from '../schema';

interface Props {
  filters: AuditLogFilters;
  onFiltersChange: (f: AuditLogFilters) => void;
}

const ENTITY_TYPES = [
  'user',
  'session',
  'lead',
  'counselling_session',
  'participant',
  'enrolment',
  'academy',
  'programme',
  'batch',
  'attendance',
  'assessment',
  'certificate',
  'career_profile',
  'placement',
  'employer',
  'alumni_record',
  'fee_account',
  'payment',
  'communication',
  'college',
  'report',
  'settings',
] as const;

export function AuditFilterBar({ filters, onFiltersChange }: Props) {
  const [activePreset, setActivePreset] = useState<string>('all');

  function applyPreset(presetId: string) {
    const preset = REGISTER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePreset(presetId);
    onFiltersChange({
      action: '',
      entityType: '',
      actorUid: '',
      dateFrom: '',
      dateTo: '',
      ...preset.filters,
    });
  }

  return (
    <div className="space-y-3">
      {/* Register presets */}
      <div className="flex flex-wrap gap-2">
        {REGISTER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            id={`audit-preset-${preset.id}`}
            title={preset.description}
            onClick={() => applyPreset(preset.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activePreset === preset.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Filter inputs */}
      <div className="flex flex-wrap gap-2">
        <select
          id="audit-filter-action"
          value={filters.action}
          onChange={(e) => {
            setActivePreset('custom');
            onFiltersChange({ ...filters, action: e.target.value as AuditLogFilters['action'] });
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          id="audit-filter-entity-type"
          value={filters.entityType}
          onChange={(e) => {
            setActivePreset('custom');
            onFiltersChange({
              ...filters,
              entityType: e.target.value as AuditLogFilters['entityType'],
            });
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All entity types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          id="audit-filter-date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(e) => {
            setActivePreset('custom');
            onFiltersChange({ ...filters, dateFrom: e.target.value });
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          id="audit-filter-date-to"
          type="date"
          value={filters.dateTo}
          onChange={(e) => {
            setActivePreset('custom');
            onFiltersChange({ ...filters, dateTo: e.target.value });
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <button
          onClick={() => applyPreset('all')}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
