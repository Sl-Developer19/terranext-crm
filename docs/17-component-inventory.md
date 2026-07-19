# 17 — Component Inventory

**TerraNext Business OS · Architecture Hardening**
Reusable components only (feature-private components live with their feature until the rule-of-two promotes them — Doc 07 §6). All accept `className`, are dark-mode + keyboard verified, and use design tokens exclusively.

## 1. Layout (`components/layout`)

| Component | Purpose | Key props | Variants / notes |
|---|---|---|---|
| AppShell | Authenticated frame: sidebar + topbar + content | `children` | reads session context; renders nav from `config/nav.ts` |
| Sidebar | Role-scoped nav | `items` (filtered NavItem[]) | expanded / icon-rail / mobile drawer |
| Topbar | Breadcrumbs, global search slot, user menu | — | user menu: profile, theme, sign out |
| PageHeader | Title, description, action slot | `title, description?, actions?` | sticky option for long pages |
| Breadcrumbs | Route-derived trail | `segments` | auto from route + entity labels |
| NoAccess | 403 screen | `permission` | explains scoping (Doc 05 §4) |

## 2. Primitives (`components/ui` — ShadCN base, project variants)

| Component | Purpose | Key props | Variants |
|---|---|---|---|
| Button | All actions | `variant, size, loading` | primary / secondary / outline / ghost / destructive; `loading` renders spinner+disables |
| Input, Textarea | Text entry | RHF-compatible | invalid state via aria |
| Select, Combobox | Choice / searchable choice | `options, onSearch?` | async option loading (batch/programme pickers) |
| DatePicker | Dates (date-fns) | `min?, max?` | single; range variant for filters |
| PhoneInput | E.164 entry | — | country default +91; validates to E.164 (dedupe-critical) |
| Checkbox, Switch, RadioGroup | Toggles | RHF-compatible | — |
| Card | Surface | `title?, actions?` | flat border-first (Doc 07 §5) |
| Tabs | Sectioning (profile, batch workspace) | `items` | URL-synced option (`?tab=`) |
| Dialog, Sheet | Modals / side panels | `open, onOpenChange` | dirty-check wrapper built in |
| ConfirmDialog | Irreversible confirms | `consequence, verb, requireTyped?` | typed-verb mode for gravest actions (Doc 06 §4) |
| Toast (sonner) | Feedback | — | success 4s / error sticky |
| Tooltip | Hints; required on icon-only buttons | — | — |
| StatusBadge | Every status render | `kind, label` | semantic map (Doc 07 §1); icon per kind from `config/icons.ts` |
| Skeleton | Loading silhouettes | `variant` | text / card / table-row / avatar |
| EmptyState | No-data | `icon, headline, explanation, action?` | default / filtered (clear-filters) |
| ErrorState | Query/widget failure | `error, onRetry` | maps AppError codes to copy (Doc 08 §6) |
| Stepper | Multi-step flows (S14) | `steps, current` | per-step validation gate |
| Avatar | User/participant identity | `name, photoUrl?` | initials fallback |
| IdBadge | Monospace ID display | `id, copyable` | Participant/certificate/receipt IDs (Doc 07 §2) |

## 3. Data (`components/ui` composite)

| Component | Purpose | Key props | Notes |
|---|---|---|---|
| DataTable | Every table (Doc 06 §3 contract) | `columns, query (infinite), toolbar?, onRowClick?, export?` | cursor pagination, skeleton rows, empty/error states, compact toggle |
| FilterBar | Facet filters → URL params | `facets` | shareable filtered views |
| SearchInput | Debounced token search | `onSearch` | 300ms debounce |
| ExportButton | Permission-gated export | `permission, onExport` | writes `export` audit entry |
| StatCard | KPI tile | `label, value, delta?, href?` | skeleton + error built in |
| ChartCard | Recharts wrapper | `title, timeframe, children` | dynamic-imported chart bundle (Doc 11 §4) |
| ActivityTimeline | Lead activities / participant timeline | `items (paged)` | virtualized beyond 100 rows |
| AuditTrail | Per-record History tab | `entityPath` | renders diff chips from auditLogs |

## 4. Forms (`components/forms`)

| Component | Purpose | Notes |
|---|---|---|
| Form (RHF provider) + FormField | Zod-wired field scaffold: label, control, help, error | `aria-describedby` wiring; required marker |
| FormSection | Fieldset card grouping | Doc 06 §2 layout |
| FormError | Submit-level error banner | AppError-aware; retry affordance for `unavailable` |
| DirtyGuard | Unsaved-changes prompt | route-change + beforeunload |
| FileUpload | Secure upload flow client (Doc 10 §6) | ticket request → signed PUT → status poll; size/type preflight |

## 5. Reuse Guidelines

1. **Rule of two:** a component enters this inventory only with ≥2 consumers; before that it stays feature-private.
2. **No business logic in `ui/`** — components receive data + callbacks; they never import Firestore, features, or stores (Doc 02 §5 lint-enforced).
3. **Variants over forks:** extend via `cva` variants, never copy-paste a sibling component.
4. **States are part of the contract:** a data-displaying component without loading/empty/error handling is incomplete — review-blocking.
5. **Every addition updates this doc + a usage example in `docs/components.md`** (grown during implementation).
