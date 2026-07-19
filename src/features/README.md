# Feature Modules

One folder per business module (Doc 01 §3 · Doc 02 §3). Structure per feature:

```
features/<name>/
├─ components/    # feature-private UI
├─ hooks/         # TanStack Query hooks (use-<x>.ts, keys.ts factory)
├─ actions/       # server actions ('use server')
├─ schema.ts      # Zod schemas + inferred types — the domain model
├─ logic.ts       # pure business rules; BR-xx functions carry the rule id in JSDoc
├─ paths.ts       # Firestore path builders — collection names appear ONLY here
└─ index.ts       # PUBLIC API — the only import surface for other features
```

Rules (lint-enforced, Doc 02 §5):

- Other features import **only** from `features/<name>` (the index). Deep imports are errors.
- `schema.ts` and `logic.ts` are framework-free — no React/Next/Firebase imports (ADR-004: reusable by Functions, portals, mobile).
- Every mutation goes through `withAudit` or an Admin-SDK action that writes audit (BR-06).
- A new collection in `paths.ts` requires: rules block + Doc 18 row + indexes + Data Dictionary entry in the same PR.

Composite transactions belong to the feature that owns the triggering user intent
(e.g. `convertLead` lives in `admissions` even though it touches leads, participants,
batches, and fees — Doc 23 §2 Modularity note).
