# ADR-012 — Why Money Is Stored as Integer Paise?

Status: **Accepted** · Date: 2026-07-19

## Context
Fees, instalments, discounts, payments, and balances (Doc 03 §1.7) are core records with legal weight (receipts). JavaScript numbers are IEEE-754 doubles; `0.1 + 0.2 !== 0.3`. Firestore stores what JS gives it.

## Decision
All monetary amounts are **integers in the minor unit** — `amountPaise: number` (₹1 = 100 paise). Formatting to rupees happens only at the display edge (`lib/utils/format.ts`). Arithmetic (balances, instalment sums) is integer arithmetic, exact by construction.

## Alternatives Considered
1. **Float rupees** — rejected: rounding drift across instalment sums is a real-world receipts discrepancy waiting to happen.
2. **Decimal strings ("1500.00")** — rejected: no arithmetic without parsing, no numeric queries (`balancePaise > 0` powers the pending-fee report), sort as strings.
3. **A money object `{units, nanos}` (Google money proto)** — rejected: over-general for a single-currency phase; harder to query.

## Pros
Exact arithmetic; queryable and sortable; unambiguous in exports and the audit trail; Zod-enforced (`z.number().int().nonnegative()`).

## Cons
Human-unfriendly raw values (150000 = ₹1,500) — mitigated by the single formatting utility and the `Paise` suffix convention making the unit impossible to mistake; multi-currency future requires a field rename.

## Long-Term Impact
Multi-country (Doc 12 §6) generalizes this to `amountMinor` + `currency` — a mechanical, versioned migration (`schemaVersion` bump), not a redesign. The discipline (integer minor units, display-edge formatting) is currency-agnostic and survives unchanged.
