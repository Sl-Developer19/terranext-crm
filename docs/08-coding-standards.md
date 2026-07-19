# 08 — Coding Standards

**TerraNext Business OS · Architecture Blueprint**

---

## 1. Language & Compiler Baseline

- TypeScript `strict: true` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. `any` is lint-error (`unknown` + narrowing instead). No non-null `!` except after an explicit guard with a comment.
- ESLint: `next/core-web-vitals`, `@typescript-eslint` strict, `eslint-plugin-boundaries` (import rules, Doc 02 §5). Prettier for format — style is never debated in review.

## 2. Naming (summary — full table in Doc 02 §2)

- Files/folders kebab-case; components PascalCase; hooks `useX`; server actions `<verb><Entity>Action`; Cloud Functions `<verb><Entity>` (`provisionUser`, `createLead`); booleans read as predicates (`isEligible`, `hasBalance`); event handlers `handle<Event>`.
- Firestore naming: collections camelCase plural (`feeAccounts`), fields camelCase, enum values snake_case strings (`counselling_booked`). Collection names appear **only** in `paths.ts` files.
- Domain vocabulary is BRD vocabulary: `participant` (never "student" in code), `programme` (BRD spelling), `enrolment`, `batch`, `lead`. A glossary drift is a review-blocking comment.

## 3. Component Rules

- Server Components by default; `'use client'` only where interaction demands it, as low in the tree as possible.
- Max ~150 lines per component before splitting; hooks extract logic when a component holds >2 pieces of coordinated state.
- Props typed inline `interface Props`; no `React.FC`. Children composition over config-object props.

## 4. Hook & Query Rules

- All Firestore reads via TanStack Query hooks in `features/*/hooks`; query keys are tuples from a per-feature `keys.ts` factory (`leadKeys.list(filters)`, `leadKeys.detail(id)`) — never inline string arrays.
- Mutations via server actions wrapped in `useMutation`; every mutation invalidates the precise keys it affects (documented next to the action).
- No `useEffect` data fetching. No state mirrored from props.

## 5. Service / Action Rules

- Server actions: validate input with the feature's Zod schema **first line**; check permission **second line** (`requirePermission`); business rule check third (`logic.ts` functions); then the audited write. This order is fixed and reviewed.
- Functions (`functions/`): one file per function; idempotency documented for every trigger (e.g. alumni trigger checks existing record before create).
- All privileged writes return `Result<T, AppError>` (below) — never throw across the action boundary.

## 6. Error Handling Standards

Single error taxonomy in `lib/utils/result.ts`:

```ts
type AppErrorCode =
  | 'validation'      // Zod failure — field map attached
  | 'permission'      // RBAC denial
  | 'not_found'
  | 'conflict'        // duplicate lead, capacity full (BR-04), stale write
  | 'precondition'    // business rule blocked (BR-02, BR-03) — rule id attached
  | 'unavailable'     // network/Firestore transient — retryable
  | 'internal';       // unexpected — logged with digest, generic message to UI

type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
```

- UI maps codes to standard presentations (Doc 06 §6): `validation` → field errors; `precondition` → amber callout naming the rule in business language ("Counselling outcome required before admission — BR-02"); `unavailable` → retry affordance; `internal` → generic + digest id.
- Never swallow errors; never `console.log` an error object as handling; user-facing messages never leak paths, UIDs, or stack traces.

## 7. Logging Standards

- **Client:** no PII to console in production; errors reported with digest id only.
- **Server/Functions:** structured JSON via a thin `logger` (`level, event, entityPath?, actorUid?, digest, durationMs`) — greppable in Cloud Logging. `info` for lifecycle events, `warn` for business-rule rejections, `error` for internals.
- **Business-significant events go to `auditLogs`, not the logger** — logs are operational (30–90d retention), audit is the permanent record (BR-06). A change that writes only to the logger where audit is required is a review-blocking bug.

## 8. Commenting Standards

- Comments state **constraints and why**, never what the next line does.
- Required: every `logic.ts` rule function carries a JSDoc line referencing its source (`/** BR-03: certificate requires attendance ≥ programme.certificateRules.minAttendancePct */`).
- Required: every Firestore composite-index-dependent query notes its index (`// index: leads(stage, nextFollowUpAt)`).
- `TODO` comments are forbidden in merged code — unfinished work is an issue/ADR, not a comment.
- ADRs: decisions that change a blueprint go to `docs/adr/NNN-title.md` (context → decision → consequences), and the blueprint is updated in the same PR.
