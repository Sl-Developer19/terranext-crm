# ADR-010 — Why Multi-Branch Ready from Day One?

Status: **Accepted** · Date: 2026-07-19

## Context
The roadmap (BRD §30 / Doc 12 §6) names multi-branch, multi-academy, multi-country expansion. Today there is exactly one branch. Full multi-tenancy now would be speculative complexity (rejected, Doc 12 §7); ignoring tenancy entirely would make expansion a whole-database migration — every document rewritten, every index rebuilt, every query touched.

## Decision
Ship the **cheapest irreversible parts** of tenancy now: `branchId: "HQ"` on every document (Doc 03 §0 envelope), `branchId` in auth claims, composite indexes designed with `branchId` as an early field, counters namespaced per-scope-capable. Build **no** branch UI, no tenant resolver, no per-branch config trees.

## Alternatives Considered
1. **No tenancy fields until needed** — rejected: adding a required field to every existing document later is a full backfill migration + index rebuild + rules rewrite under production load — the classic "we'll add tenancy later" trap.
2. **Full multi-tenant framework now** — rejected (Doc 12 §7): ~50× the cost of the field for features no one uses; YAGNI.
3. **Branch as top-level path segment (`branches/{id}/participants/...`)** — rejected: physically partitions data before partitioning is needed, makes cross-branch queries (Founder dashboards) collection-group everything, and — critically — breaks BR-01 if a participant engages two branches (the lifetime record must span branches).

## Pros
Expansion becomes additive: predicates + UI + `branch_manager` role (reserved, Doc 04 §6), zero data migration; costs almost nothing today (one field, one claim); Founder-level cross-branch reporting stays natural (top-level collections).

## Cons
A dormant field invites drift if writes forget it — mitigated: envelope validation in rules and the base Zod schema require it; `"HQ"` semantics must be documented so it isn't mistaken for optional.

## Long-Term Impact
Multi-*country* remains the unsolved case (data residency may force per-region projects — Doc 13 R-8; ADR-005). `branchId` deliberately does not claim to solve residency; it solves organizational scoping within one jurisdiction.
