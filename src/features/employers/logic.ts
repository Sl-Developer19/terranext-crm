import type { Employer, EmployerStatus } from './schema';

/** Pure employer-directory rules (no I/O). */

export function employerStatusLabel(status: EmployerStatus): string {
  return status === 'active' ? 'Active' : 'Archived';
}

/** A one-line contact summary for the directory table, skipping unset fields. */
export function formatContactSummary(contact: Employer['contact']): string {
  return [contact.name, contact.phone, contact.email].filter(Boolean).join(' · ') || '—';
}

/** An employer with active placements shouldn't be archived silently. */
export function archiveWarning(employer: Pick<Employer, 'placementCount'>): string | null {
  if (employer.placementCount === 0) return null;
  return `This employer has ${employer.placementCount} placement${employer.placementCount === 1 ? '' : 's'} on record.`;
}
