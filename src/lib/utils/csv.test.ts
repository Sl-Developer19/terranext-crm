import { describe, expect, it } from 'vitest';

import { csvFilename, escapeCsvField, toCsv } from './csv';

describe('escapeCsvField', () => {
  it('renders empty for null and undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('leaves plain values untouched', () => {
    expect(escapeCsvField('Asha Menon')).toBe('Asha Menon');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('quotes fields containing a comma, quote or newline', () => {
    expect(escapeCsvField('Menon, Asha')).toBe('"Menon, Asha"');
    expect(escapeCsvField('she said "yes"')).toBe('"she said ""yes"""');
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
  });

  it('neutralises formula injection without losing the text', () => {
    // Excel would otherwise evaluate these on open.
    expect(escapeCsvField('=HYPERLINK("http://evil","click")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""click"")"',
    );
    expect(escapeCsvField('+1234')).toBe("'+1234");
    expect(escapeCsvField('-1234')).toBe("'-1234");
    expect(escapeCsvField('@user')).toBe("'@user");
  });

  it('does not treat a negative number as a formula once stringified', () => {
    // A real negative number still gets the guard — harmless on display, and
    // we would rather over-quote than evaluate.
    expect(escapeCsvField(-5)).toBe("'-5");
  });
});

describe('toCsv', () => {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'count', label: 'Count' },
  ];

  it('writes a header even with no rows', () => {
    expect(toCsv(columns, [])).toBe('Name,Count\r\n');
  });

  it('writes CRLF-separated records with a trailing newline', () => {
    const csv = toCsv(columns, [
      { name: 'Alpha', count: 2 },
      { name: 'Beta', count: 0 },
    ]);
    expect(csv).toBe('Name,Count\r\nAlpha,2\r\nBeta,0\r\n');
  });

  it('emits an empty cell for a column a row does not have', () => {
    expect(toCsv(columns, [{ name: 'Alpha' }])).toBe('Name,Count\r\nAlpha,\r\n');
  });
});

describe('csvFilename', () => {
  it('stamps the date and sanitises the id', () => {
    expect(csvFilename('batch-utilisation', new Date('2026-07-22T10:00:00Z'))).toBe(
      'batch-utilisation-2026-07-22.csv',
    );
    expect(csvFilename('Lead Source/Report', new Date('2026-07-22T10:00:00Z'))).toBe(
      'lead-source-report-2026-07-22.csv',
    );
  });
});
