# 02 — Folder Architecture

**TerraNext Business OS · Architecture Blueprint**

---

## 1. Final Folder Structure

```
crm/
├─ docs/                          # this blueprint set + future ADRs
├─ functions/                     # Cloud Functions workspace (separate package.json)
│  ├─ src/
│  │  ├─ callable/                # provisionUser.ts, setUserRole.ts, convertLead.ts …
│  │  ├─ http/                    # createLead.ts (website intake), verifyCertificate.ts
│  │  ├─ triggers/                # onCertificateIssued.ts (BR-05 alumni), attendance rollups
│  │  ├─ lib/                     # admin init, shared helpers
│  │  └─ index.ts
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/
│  │  ├─ (app)/                   # authenticated shell: layout.tsx renders AppShell
│  │  │  ├─ dashboard/
│  │  │  ├─ leads/  [id]/
│  │  │  ├─ counselling/
│  │  │  ├─ admissions/
│  │  │  ├─ participants/  [id]/
│  │  │  ├─ programmes/           # academies + programmes + batches
│  │  │  ├─ batches/  [id]/
│  │  │  ├─ attendance/
│  │  │  ├─ assessments/
│  │  │  ├─ certificates/
│  │  │  ├─ career/               # career guidance + trade & career interest
│  │  │  ├─ placements/
│  │  │  ├─ employers/
│  │  │  ├─ alumni/
│  │  │  ├─ fees/
│  │  │  ├─ communications/
│  │  │  ├─ colleges/
│  │  │  ├─ reports/
│  │  │  └─ admin/                # users/, roles/, audit-logs/, settings/
│  │  ├─ api/                     # route handlers only where server actions don't fit
│  │  ├─ layout.tsx  globals.css
│  ├─ components/
│  │  ├─ ui/                      # ShadCN primitives + variants (no business logic)
│  │  └─ layout/                  # AppShell, Sidebar, Topbar, PageHeader, Breadcrumbs
│  ├─ features/
│  │  └─ <feature>/               # one folder per module (Doc 01 §3)
│  │     ├─ components/           # feature-private UI
│  │     ├─ hooks/                # TanStack Query hooks (use-leads.ts …)
│  │     ├─ actions/              # server actions ('use server')
│  │     ├─ schema.ts             # Zod schemas + inferred types (domain model)
│  │     ├─ logic.ts              # pure business rules (BR-xx implementations)
│  │     ├─ paths.ts              # Firestore path builders for this feature only
│  │     └─ index.ts              # PUBLIC API of the feature (only import surface)
│  ├─ lib/
│  │  ├─ firebase/                # client.ts, admin.ts, converters.ts
│  │  ├─ auth/                    # session.ts, middleware helpers, use-auth.ts
│  │  ├─ rbac/                    # roles.ts, permissions.ts, use-can.ts, require.ts
│  │  ├─ audit/                   # with-audit.ts, audit-types.ts
│  │  └─ utils/                   # cn.ts, dates.ts, format.ts, result.ts
│  ├─ stores/                     # session-store.ts, ui-store.ts (Zustand)
│  ├─ types/                      # cross-feature domain types (ids.ts, tenancy.ts, common.ts)
│  ├─ config/                     # nav.ts, site.ts, feature-flags.ts
│  └─ middleware.ts
├─ tests/                         # rules tests (emulator), domain logic tests
├─ firestore.rules  firestore.indexes.json  storage.rules
├─ firebase.json  .firebaserc  apphosting.yaml
└─ tailwind.config.ts  tsconfig.json  .env.example  README.md
```

## 2. Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Folders | kebab-case | `features/leads`, `audit-logs/` |
| Components | PascalCase file = component | `LeadTable.tsx`, `PageHeader.tsx` |
| Hooks | `use-` kebab file, camelCase export | `use-leads.ts` → `useLeads()` |
| Server actions | verb-first camelCase | `convertLeadAction`, `recordAttendanceAction` |
| Zod schemas | `<Entity>Schema`, type via `z.infer` | `LeadSchema`, `type Lead` |
| Pure logic | verb/predicate names | `canConvertLead`, `calculateAttendancePct` |
| Firestore paths | only in `paths.ts` per feature | `leadPath(id)`, `attendancePath(batchId, sessionId)` |
| Constants | SCREAMING_SNAKE in `constants.ts` | `LEAD_STAGES`, `MAX_BATCH_NOTE_LENGTH` |
| Route segments | kebab-case, plural for collections | `/participants/[id]`, `/audit-logs` |

## 3. Module Boundaries

- A feature's **only public surface is its `index.ts`**. Everything else is private.
- Features export: page-level components, query hooks, and read-only widgets (for `dashboard`/`reports`). They do **not** export Firestore paths or internal components.
- Cross-feature data needs are satisfied by importing the owning feature's hooks (e.g. `admissions` imports `useLead` from `features/leads`), never by re-declaring paths.
- Shared domain identity types (ParticipantId, tenancy fields) live in `src/types` because multiple features and `functions/` need them.

## 4. Shared Libraries

| Library | Owns | Never contains |
|---|---|---|
| `lib/firebase` | SDK init, generic typed converter factory | business logic, feature paths |
| `lib/auth` | session cookie handling, token refresh, `useAuth` | permission decisions (that's rbac) |
| `lib/rbac` | role/permission model, `useCan`, `requirePermission` | UI components |
| `lib/audit` | `withAudit()` mutation wrapper, audit doc shape | direct UI usage |
| `lib/utils` | `cn`, date/format helpers, `Result<T,E>` type | anything stateful |

`functions/` duplicates nothing: it imports domain schemas from `src` via a TS path alias to a build-time copy (schemas are framework-free per Doc 01 A-3).

## 5. Import Rules (lint-enforced)

Enforced with `eslint-plugin-boundaries` (element types: `app`, `features`, `ui`, `layout`, `lib`, `stores`, `types`, `config`):

1. `app` → may import `features` (public API), `layout`, `lib/auth`, `lib/rbac`, `config`.
2. `features/X` → may import `ui`, `lib/*`, `stores`, `types`, `config`, and **other features only via `features/Y` root (index.ts)**.
3. `ui` → may import `lib/utils` only. Zero feature or Firebase imports.
4. `lib` → may import `types`, `lib/utils`. Never `features`, never `app`.
5. `types` → imports nothing project-internal.
6. Deep imports (`features/leads/components/…` from outside `features/leads`) are a lint **error**.
7. `firebase-admin` may only be imported in `lib/firebase/admin.ts`, server actions, and `functions/` (lint rule + `server-only` package guard).

## 6. Rationale Notes

- Route group `(app)` gives one authenticated layout + middleware matcher; `(auth)` keeps login chrome-free.
- `paths.ts` per feature is the single place collection names appear — renaming/sharding a collection is a one-file change plus rules/indexes.
- `logic.ts` isolation is what makes BR rules testable without emulators.
