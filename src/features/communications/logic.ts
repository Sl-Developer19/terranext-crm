import type { StatusKind } from '@/components/ui/badge';

import { BODY_PREVIEW_MAX, type Channel, type CommStatus, type Communication } from './schema';

/** Pure communications rules (no I/O). */

/**
 * The provider is the system of record for full bodies (Doc 14 §19) — we keep
 * a bounded preview so the log stays readable without becoming a message store.
 */
export function toBodyPreview(body: string): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= BODY_PREVIEW_MAX) return collapsed;
  return `${collapsed.slice(0, BODY_PREVIEW_MAX - 1).trimEnd()}…`;
}

export function channelLabel(channel: Channel): string {
  return channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email';
}

export function statusLabel(status: CommStatus): string {
  return status === 'queued' ? 'Queued' : status === 'sent' ? 'Sent' : 'Failed';
}

export function statusTone(status: CommStatus): StatusKind {
  return status === 'sent' ? 'success' : status === 'queued' ? 'progress' : 'danger';
}

export interface CommunicationFilterCriteria {
  channel?: Channel | undefined;
  status?: CommStatus | undefined;
  refType?: string | undefined;
  refId?: string | undefined;
  search?: string | undefined;
}

/** Free-text search covers who it was about and what it said — not internal IDs. */
export function filterCommunications(
  rows: readonly Communication[],
  criteria: CommunicationFilterCriteria,
): Communication[] {
  const needle = criteria.search?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (criteria.channel && row.channel !== criteria.channel) return false;
    if (criteria.status && row.status !== criteria.status) return false;
    if (criteria.refType && row.refType !== criteria.refType) return false;
    if (criteria.refId && row.refId !== criteria.refId) return false;
    if (needle) {
      const haystack = `${row.refName} ${row.subject ?? ''} ${row.bodyPreview}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
