import { describe, expect, it } from 'vitest';

import { channelLabel, filterCommunications, statusTone, toBodyPreview } from './logic';
import { BODY_PREVIEW_MAX, type Communication } from './schema';

function row(overrides: Partial<Communication> = {}): Communication {
  return {
    id: 'c1',
    channel: 'email',
    direction: 'outbound',
    refType: 'lead',
    refId: 'l1',
    refName: 'Asha Menon',
    templateKey: null,
    subject: 'Your enquiry',
    bodyPreview: 'Thank you for your interest.',
    status: 'sent',
    sentAt: '2026-07-01T00:00:00.000Z',
    byUid: 'u1',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toBodyPreview', () => {
  it('collapses whitespace', () => {
    expect(toBodyPreview('  hello \n\n  world  ')).toBe('hello world');
  });

  it('truncates to the preview cap with an ellipsis', () => {
    const preview = toBodyPreview('a'.repeat(BODY_PREVIEW_MAX + 50));
    expect(preview).toHaveLength(BODY_PREVIEW_MAX);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('leaves a body at exactly the cap untouched', () => {
    const body = 'a'.repeat(BODY_PREVIEW_MAX);
    expect(toBodyPreview(body)).toBe(body);
  });
});

describe('channelLabel', () => {
  it('uses provider-correct casing', () => {
    expect(channelLabel('sms')).toBe('SMS');
    expect(channelLabel('whatsapp')).toBe('WhatsApp');
    expect(channelLabel('email')).toBe('Email');
  });
});

describe('statusTone', () => {
  it('treats queued as in-progress rather than success', () => {
    expect(statusTone('queued')).toBe('progress');
    expect(statusTone('sent')).toBe('success');
    expect(statusTone('failed')).toBe('danger');
  });
});

describe('filterCommunications', () => {
  const rows = [
    row({ id: 'a', channel: 'email', status: 'sent', refName: 'Asha Menon' }),
    row({
      id: 'b',
      channel: 'sms',
      status: 'queued',
      refType: 'participant',
      refName: 'Ravi Kumar',
    }),
    row({ id: 'c', channel: 'email', status: 'failed', refName: 'Priya Nair' }),
  ];

  it('returns everything when no criteria are given', () => {
    expect(filterCommunications(rows, {})).toHaveLength(3);
  });

  it('filters by channel and status together', () => {
    expect(
      filterCommunications(rows, { channel: 'email', status: 'failed' }).map((r) => r.id),
    ).toEqual(['c']);
  });

  it('searches recipient name case-insensitively', () => {
    expect(filterCommunications(rows, { search: 'ravi' }).map((r) => r.id)).toEqual(['b']);
  });

  it('scopes to a single record for the per-record view', () => {
    const scoped = filterCommunications(rows, { refType: 'participant' });
    expect(scoped.map((r) => r.id)).toEqual(['b']);
  });
});
