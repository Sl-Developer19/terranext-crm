# 11 — Performance Strategy

**TerraNext Business OS · Architecture Blueprint**
NFR targets (BRD Section 22): CRM screens ≤ 2s · website pages ≤ 2.5s · 10× participant growth without redesign

---

## 1. Firestore Optimization

- **Model for reads, not joins.** List screens are served by single-collection queries with denormalized display fields (Doc 03 §0) — no N+1 doc fetches per row. A table row never triggers its own `get()`.
- **Aggregates are precomputed**, not scanned: `enrolledCount` on batches (transactional), `attendancePct` on enrolments (trigger roll-up), `balancePaise` on feeAccounts (transaction with payment write), dashboard counters in `stats/{period}` docs maintained by triggers. Founder KPIs (SOP 18.10) read a handful of docs, not collections.
- `count()` aggregation queries for ad-hoc counts (cheap, no doc reads), never `.get().size`.
- Document size discipline: unbounded growth goes to subcollections (activities, timeline, payments), never arrays on the parent; `statusHistory` arrays only where bounded (~10 stage changes on placements).
- Realtime listeners (`onSnapshot`) reserved for genuinely live surfaces (today's attendance entry, follow-up queue); everything else is fetch + cache — listeners cost connection overhead and re-renders.

## 2. Query Optimization

- Every query maps to a named index (Doc 03 §3); queries always include `deletedAt == null` and (future) `branchId` — indexes are built with these leading fields from day one so multi-branch adds no migration.
- Filters happen in Firestore, not in JS (`where`, not `.filter()` on fetched arrays). Client-side filtering allowed only within an already-paginated page.
- Search: prefix `searchTokens` array-contains for names/phones (Doc 03) — adequate at current scale; Algolia/Typesense is the flagged upgrade path when full-text is demanded (Doc 13 risk R-6).
- Reports that would scan large ranges (annual reports) read pre-aggregated `stats` docs; raw scans are export jobs (Function, batched), never interactive queries.

## 3. Lazy Loading

- Route-level code splitting is free with App Router; heavy feature surfaces load only on navigation.
- Below-the-fold dashboard widgets mount on intersection (`content-visibility` + deferred query enablement `enabled: inView`).
- Participant profile tabs (Doc 05) fetch per-tab on activation — opening a profile costs the overview read only.

## 4. Dynamic Imports

`next/dynamic` for: Recharts bundles (charts are ~100KB+ — loaded only on dashboard/reports), PDF/CSV export machinery, the certificate template renderer, and any dialog whose content is heavy (rich editors). Named chunks so bundle analysis stays legible; `@next/bundle-analyzer` run is part of the perf review before go-live.

## 5. Caching

Layered:

| Layer | Policy |
|---|---|
| TanStack Query | `staleTime` per data class: catalogue (academies/programmes) 10 min; lists 30 s; detail docs 60 s; live surfaces 0 (listeners). Central defaults in one `queryClient` factory; per-key overrides documented in `keys.ts` |
| Query invalidation | mutation-scoped precise invalidation (Doc 08 §4) — no `invalidateQueries()` blanket calls |
| Next.js | static rendering for shell/chrome; all data fetching is client/TanStack (RSC data fetching used for session + first-paint projections only, `no-store`) |
| Firestore offline | default persistence on — instant back-nav renders from cache while revalidating |
| Permission map | static import (in-bundle) — zero runtime cost per check |

## 6. Pagination

- **Cursor-based everywhere** (`orderBy` + `startAfter(lastDoc)`), page size 25; offset pagination is forbidden (Firestore bills skipped docs and it breaks under concurrent writes).
- TanStack `useInfiniteQuery` for boards/feeds (leads board, timeline); numbered-page UX only where operators need it (audit logs), implemented with cursor stacks.
- Total counts shown via `count()` aggregation alongside the first page, cached 60 s — approximate freshness is acceptable for list headers.

## 7. Virtualization

- Standard tables don't virtualize (25/page renders fine).
- Virtualize (TanStack Virtual) the known long-list surfaces: batch attendance entry (roster × sessions grid), audit log stream, timeline on long-lived participants, communications history.
- Threshold rule: any scroll container that can exceed ~100 rendered rows gets virtualization; measured in review, not guessed.

## 8. Performance Budget & Verification

- Budgets: CRM route TTI ≤ 2 s on mid-range hardware / typical broadband; JS ≤ 300KB gz per route (charts routes ≤ 450KB); LCP ≤ 2 s authenticated.
- Verification cadence: Lighthouse CI on the shell + 3 heaviest routes per release; Firestore usage dashboard reviewed monthly (read amplification is the primary cost/latency risk — target < 50 doc reads per typical screen load).
