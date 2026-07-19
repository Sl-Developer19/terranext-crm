# 06 — UI Blueprint

**TerraNext Business OS · Architecture Blueprint**
Design references: Linear, Stripe Dashboard, Notion (per project brief) · NFR: usable by non-technical staff after ≤½ day training

---

## 1. Dashboard Layout

```
┌──────────┬────────────────────────────────────────────┐
│          │ Topbar: breadcrumbs · global search · user │
│ Sidebar  ├────────────────────────────────────────────┤
│ (nav,    │ PageHeader: title · description · actions  │
│ collaps- ├────────────────────────────────────────────┤
│ ible)    │ Content: max-w-screen-2xl, px-6, space-y-6 │
│          │  · KPI row (StatCard × 3-5)                │
│          │  · main grid (charts / tables / lists)     │
└──────────┴────────────────────────────────────────────┘
```

- Role dashboards are **compositions of feature-exported widgets** (Doc 01 §5): founder = KPI set from SOP 18.10; ops = today's follow-ups, admissions, pending fees; trainer = my sessions today, attendance pending.
- Every widget: title, timeframe label, skeleton state, empty state, error state, and a "view all →" link to its module.
- Density: comfortable by default; tables offer compact toggle (persisted in ui-store).

## 2. Form Standards

- **Stack:** React Hook Form + `zodResolver` with the feature's `schema.ts` — the same Zod schema validates client-side, in server actions, and (structurally) mirrors Firestore rules. One schema, three enforcement points.
- Layout: single column, max-w-2xl; related fields grouped in `<fieldset>` cards with group titles; 2-col grid only for tightly-paired fields (city/pincode).
- Every field: `<Label>` (required marker `*`), control, help text slot, error slot (`aria-describedby` wired). Errors appear on blur + submit, never on first keystroke.
- Submission: button shows spinner + disables; whole form gets `fieldset[disabled]`; success = toast + navigate or reset; failure = inline `FormError` banner with retryable message (Doc 08 error taxonomy).
- Destructive/irreversible actions (convert lead, issue certificate, record payment) always use `ConfirmDialog` with a one-line consequence statement ("This assigns a permanent Participant ID — it cannot be re-issued").
- Multi-step flows (admission conversion) use a `Stepper` with per-step validation; steps are resumable (draft persisted in form state, not Firestore).
- Autosave is **not** used — explicit save with dirty-state guard (`beforeunload` + route-change prompt) fits audit semantics better.

## 3. Table Standards

One `DataTable` component (TanStack Table wrapper) used everywhere. Contract:

- Server-driven: cursor pagination (Doc 11 §6), page size 25 (10/25/50).
- Column defs per feature; sortable columns map 1:1 to an index (Doc 03 §3) — unsortable columns are simply not sortable, we never fake client sorts on partial data.
- Toolbar: search input (searchTokens), `FilterBar` (facet chips bound to query params → shareable URLs), export button (permission `module:export`, logs audit `export`).
- Row affordances: whole row clickable → detail; overflow menu (⋯) for secondary actions gated by `useCan`.
- States: skeleton rows (same column widths), `EmptyState`, `ErrorState` with retry, "filtered to 0" variant with one-click clear-filters.
- Status columns always render `StatusBadge` (semantic color map, Doc 07) — never raw text.

## 4. Dialog Standards

| Use | Component | Rule |
|---|---|---|
| Create/edit ≤ ~6 fields | `Dialog` (modal) | closes only on explicit action; dirty-check on dismiss |
| Detail peek / longer forms | `Sheet` (right panel, 480px) | preserves list context behind |
| Irreversible confirm | `ConfirmDialog` | consequence sentence + typed verb for the gravest (certificate revoke) |
| Bulk feedback | `Toast` (sonner) | success 4s, error sticky with action |

Accessibility: Radix primitives → focus trap, `Esc`, `aria-labelledby` from dialog title; initial focus on first field, never the destructive button.

## 5. Empty States

`EmptyState` component: icon · one-line headline · one-line explanation · primary action (permission-gated). Copy is **instructional, not apologetic** — "No leads yet. Leads from the website land here automatically; add walk-ins with New Lead." Filtered-empty is a distinct variant ("No results for these filters" + Clear).

## 6. Error States

- Route-level `error.tsx` per group: friendly message, error digest id (correlates with logs, Doc 08 §7), Retry button.
- Query errors inside widgets/tables → local `ErrorState`, never a full-page break.
- Permission denial → dedicated 403 `NoAccess` screen (Doc 05 §4), visually distinct from errors.
- Offline: TanStack Query `onlineManager` banner "Reconnecting…"; mutations paused, not dropped.

## 7. Loading States

- Route transitions: `loading.tsx` renders the page's **skeleton layout** (header + content silhouettes) — same spatial structure as the loaded page to avoid layout shift (supports the ≤2s perceived-speed NFR).
- Widgets/tables: component-level skeletons; buttons: inline spinner + label ("Saving…").
- Never two stacked spinners; never spinner-only full pages.
- Optimistic updates only for low-risk toggles (e.g. follow-up done); all BR-governed mutations wait for server confirmation.
