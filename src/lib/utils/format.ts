import { format as formatDateFns } from 'date-fns';

/**
 * Display-edge formatting utilities. Money is stored as integer paise
 * everywhere (ADR-012); rupee rendering happens only here.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const inrWholeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** 150000 → "₹1,500.00" */
export function formatPaise(amountPaise: number): string {
  return inrFormatter.format(amountPaise / 100);
}

/** 150000 → "₹1,500" (dashboards, tables where paise noise hurts scanning) */
export function formatPaiseWhole(amountPaise: number): string {
  return inrWholeFormatter.format(amountPaise / 100);
}

/** "1,500.50" (user fee-plan entry) → 150050; rejects NaN/negatives at the caller via Zod */
export function parseRupeesToPaise(input: string): number {
  const normalized = input.replace(/[₹,\s]/g, '');
  return Math.round(Number(normalized) * 100);
}

export function formatDate(date: Date): string {
  return formatDateFns(date, 'dd MMM yyyy');
}

export function formatDateTime(date: Date): string {
  return formatDateFns(date, 'dd MMM yyyy, h:mm a');
}

export function formatTime(date: Date): string {
  return formatDateFns(date, 'h:mm a');
}

/** 0–100 roll-up display, one decimal only when needed: 80 → "80%", 79.5 → "79.5%" */
export function formatPercent(value: number): string {
  // scale-then-round instead of toFixed: (79.55).toFixed(1) === "79.5"
  // because 79.55 has no exact binary representation
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}
