/**
 * CSV serialisation for audited exports (S42, S52).
 *
 * Two hazards this handles that a naive `join(',')` does not:
 *
 * 1. **Quoting** — any field containing a comma, quote or newline is quoted
 *    and its inner quotes doubled, per RFC 4180.
 * 2. **Formula injection** — a field starting with `=`, `+`, `-`, `@`, or a
 *    tab/CR is interpreted as a formula by Excel and Sheets. Exports here
 *    carry user-entered text (lead names, notes, reasons), so a value like
 *    `=HYPERLINK(...)` would execute on open in the recipient's spreadsheet.
 *    We prefix those with a single quote, which spreadsheets strip on display
 *    but never evaluate.
 */

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export type CsvValue = string | number | boolean | null | undefined;

export function escapeCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return '';

  let field = String(value);
  if (FORMULA_TRIGGER.test(field)) field = `'${field}`;
  if (NEEDS_QUOTING.test(field)) field = `"${field.replace(/"/g, '""')}"`;
  return field;
}

export function toCsv(
  columns: readonly { key: string; label: string }[],
  rows: readonly Record<string, CsvValue>[],
): string {
  const header = columns.map((column) => escapeCsvField(column.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(','));
  // Trailing newline: POSIX tools and Excel both treat a final record without
  // one as a partial line.
  return [header, ...body].join('\r\n') + '\r\n';
}

/** Timestamped, filesystem-safe download name, e.g. `batch-utilisation-2026-07-22.csv`. */
export function csvFilename(reportId: string, at: Date = new Date()): string {
  const date = at.toISOString().slice(0, 10);
  const safe = reportId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `${safe}-${date}.csv`;
}
