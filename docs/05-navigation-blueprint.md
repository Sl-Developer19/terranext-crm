# 05 — Navigation Blueprint

**TerraNext Business OS · Architecture Blueprint**

---

## 1. Sidebar Architecture

- Single source of truth: `src/config/nav.ts` — an array of nav groups, each item declaring `{ label, href, icon, permission: 'module:view', badge? }`.
- The sidebar renders **only items the session's role can view** (via the same `ROLE_PERMISSIONS` map as Doc 04 — nav and guards can never disagree because they read one map).
- Groups mirror the lifecycle so non-technical staff can "walk the pipeline" left-to-right (BRD usability NFR: productive after half a day).
- Collapsible on desktop (icon rail), sheet/drawer on mobile. Active state matches deepest route segment.

## 2. Navigation Tree (full tree; each role sees its permitted subset)

```
Dashboard
Acquisition
├─ Leads                 (leads:view)
├─ Counselling           (counselling:view)
├─ Admissions            (admissions:view)
└─ Colleges              (colleges:view)
Academics
├─ Participants          (participants:view)
├─ Programmes            (programmes:view)      # academies + programmes tabs
├─ Batches               (batches:view)
├─ Attendance            (attendance:view)
├─ Assessments           (assessments:view)
└─ Certificates          (certificates:view)
Career
├─ Career Interest       (career:view)
├─ Placements            (placements:view)
├─ Employers             (employers:view)
└─ Alumni                (alumni:view)
Operations
├─ Fees & Collections    (fees:view)
├─ Communications        (communications:view)
└─ Reports               (reports:view)
Administration
├─ Users                 (users:view)
├─ Roles & Permissions   (roles:view)
├─ Audit Logs            (audit:view)
└─ Settings              (settings:view)
```

Example scoped renders: **Trainer** sees Dashboard, Participants, Batches, Attendance, Assessments, Certificates (all batch-scoped). **Finance Officer** sees Dashboard, Participants (finance fields), Fees, Communications, Reports.

## 3. Route Map

| Route | Screen | Guard |
|---|---|---|
| `/login` | Login | redirect to `/dashboard` if authed |
| `/dashboard` | Role dashboard | any authed staff |
| `/leads` · `/leads/[id]` | Lead board/list · Lead detail (activities, counselling, convert) | `leads:view` |
| `/counselling` | Session log + upcoming | `counselling:view` |
| `/admissions` | Conversion queue (BR-02 checklist) | `admissions:view` |
| `/participants` · `/participants/[id]` | Directory · Lifetime profile (tabs: overview, enrolments, attendance, assessments, certificates, career, fees, comms, timeline) | `participants:view` + field-level per role |
| `/programmes` | Academies & programmes catalogue | `programmes:view` |
| `/batches` · `/batches/[id]` | Batch list · Batch workspace (roster, sessions, attendance entry) | `batches:view` (+trainer scope) |
| `/attendance` | Cross-batch view + risk report | `attendance:view` |
| `/assessments` | Assessment events + score entry | `assessments:view` |
| `/certificates` | Issued registry + eligibility queue | `certificates:view` |
| `/career` · `/placements` · `/employers` · `/alumni` | Career pipeline screens | respective `:view` |
| `/fees` | Fee accounts, pending-fee report, receipts | `fees:view` |
| `/communications` | Log + send (templated) | `communications:view` |
| `/colleges` | Colleges + campus leaders | `colleges:view` |
| `/reports` | Report centre (Phase 11 catalogue) | `reports:view` |
| `/admin/users` · `/admin/roles` · `/admin/audit-logs` · `/admin/settings` | Platform admin | `users:view` etc. |

URL convention: list = plural noun; detail = `[id]`; actions are dialogs/panels on these routes, not separate URLs (except multi-step admission: `/admissions/convert/[leadId]`).

## 4. Route Guards

Three checkpoints, defense in depth (Doc 04 §4):

1. **`middleware.ts`** — verifies the Firebase session cookie on every `(app)` request; no/invalid cookie → `/login?next=…`. Disabled user (`users.status`) → `/login?reason=disabled`.
2. **`(app)/layout.tsx`** (server) — loads session claims once, provides them via context; renders nav from permitted items.
3. **Per-route `requirePermission()`** (server component top) — role lacking `module:view` → renders a 403 screen (`NoAccess` component, with "request access" mailto) — never a silent redirect, so staff understand scoping.

Client-side `useCan` only ever hides/disables affordances — it is UX, not security.

## 5. Future Portal Navigation (Doc 12 alignment)

Portals are **separate apps with their own nav**, not CRM branches: `portal.terranext…` (student/parent) and `partners.terranext…` (employer) will each carry a 4–6 item nav (e.g. Student: Overview · Attendance · Assessments · Certificates · Fees). Nothing in the CRM nav config needs to change for portals to exist — the reserved work is only in security rules (portal role predicates, Doc 04 §6). The CRM's `config/nav.ts` shape (permission-driven items) is reused as the pattern for portal nav configs.
