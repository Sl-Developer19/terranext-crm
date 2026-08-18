# 16 — Screen Inventory

**TerraNext Business OS · Architecture Hardening**
Every screen in the CRM. Roles column = roles with any access (scope per Doc 04 matrix). Components reference Doc 17. All list screens use `DataTable` + `FilterBar` + `EmptyState`/`ErrorState`/skeletons per Doc 06 — listed once here, not repeated per row.

## Auth & Shell

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| S01 | Login | `/login` | Email/password via `POST /api/auth/login` (ADR-013); `LoginForm`; generic-failure + lockout-countdown (cosmetic; server-enforced) states | public | sign in |
| S02 | 403 No Access | (inline) | Permission denial explanation, request-access mailto | all | — |
| S03 | Dashboard | `/dashboard` | Role-scoped widget grid (`StatCard`, `ChartCard`, feature widgets); founder = SOP 18.10 KPIs; ops = follow-ups/admissions/pending fees; trainer = today's sessions | all (scoped) | navigate to modules |

## Acquisition

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| S10 | Leads list/board | `/leads` | Pipeline table + stage board toggle; filters: stage, source, assignee, college; dedupe badge | founder, ops, consultant | new walk-in lead (`LeadFormDialog`), assign, export (ops/founder) |
> ✅ v1 shipped: table view, row-scoped to assigned leads for consultants, staff-entered create with advisory dedupe. **Not yet built:** board/kanban toggle, stage/source/assignee/college filters, export. Fast-follow.
| S11 | Lead detail | `/leads/[id]` | Profile + `ActivityTimeline` + counselling history + consent record | founder, ops, consultant | log activity, set follow-up, change stage, book counselling, → convert (ops) |
> ✅ v1 shipped: profile, activity timeline, stage change (auto-logs `stage_change` activity), follow-up date, assignment (ops). **Not yet built:** counselling history tab (S12 doesn't exist yet), consent-record display, → convert action (M3 territory). Fast-follow.
| S12 | Counselling | `/counselling` | Upcoming/held sessions table; session capture form (`CounsellingSessionForm`: notes, needs, recommendation, outcome) | consultant, ops, founder | record session (BR-02 data) |
| S13 | Admissions queue | `/admissions` | Leads at `hot`/`counselling_attended` with BR-02 checklist per row | ops, founder | open conversion |
| S14 | Convert lead | `/admissions/convert/[leadId]` | `Stepper`: verify details → duplicate check (BR-01) → programme/batch (BR-04 capacity shown) → fee plan → confirm (ConfirmDialog: permanent ID warning) | ops | convertLead |
| S15 | Colleges | `/colleges` (+`[id]`) | College master + campus leaders sub-table; per-college lead stats | ops, consultant, founder | CRUD college/leader |

## Academics

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| S20 | Participants directory | `/participants` | Search (tokens), filters: status, programme, batch | all staff (field-scoped) | export (ops/founder) |
| S21 | Participant profile | `/participants/[id]` | **The lifetime record.** Tabs: Overview · Enrolments · Attendance · Assessments · Certificates · Career · Fees · Comms · Timeline · History(audit). Tabs render per role (finance sees Fees, trainer sees batch-scoped academics) | all staff (scoped) | edit personal (ops), tag, per-tab actions deep-link to modules |
| S22 | Programmes & academies | `/programmes` | Catalogue tabs; programme form incl. `certificateRules` (BR-03 config) + default fee plan | coordinator, ops (edit); others view | CRUD, archive |
| S23 | Batches list | `/batches` | Filters: programme, status, trainer; utilization bar (BR-04) | coordinator, ops, trainer (own), founder | create batch |
| S24 | Batch workspace | `/batches/[id]` | Tabs: Roster · Sessions · Attendance grid (virtualized) · Assessments; capacity header | coordinator, ops, trainer (assigned) | manage sessions, mark attendance, allocate participants |
| S25 | Attendance overview | `/attendance` | Cross-batch view; **attendance risk report** (below-threshold mid-batch) | coordinator, ops, founder | export |
| S26 | Assessments | `/assessments` | Events list + `ScoreEntryGrid` per event | coordinator, trainer (assigned) | create event, enter scores |
| S27 | Certificates | `/certificates` | Tabs: Eligibility queue (BR-03 progress per candidate) · Issued registry | coordinator, ops, founder | issue (recompute + confirm), revoke (override+reason) |

## Career & Alumni

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| S30 | Career interest | `/career` | Career profiles: interest data, readiness, eligibility states (BR-09) | placement, ops (view), founder | record interest, evaluate eligibility (checklist dialog), log guidance session |
| S31 | Placements pipeline | `/placements` | Status-column board `under_review → placed`; fee disclosure indicator (BR-08) | placement, founder, ops (view) | create (gated on eligible), advance status (+note), export |
| S32 | Employers | `/employers` | Employer directory + per-employer placement history | placement; others view | CRUD |
| S33 | Alumni | `/alumni` | Alumni registry; engagement counters; success-story consent flags | ops, founder; placement/coordinator view | record engagement, toggle consent (audited) |

## Operations

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| S40 | Fees & collections | `/fees` | Accounts table: balance, next due, overdue badges; **pending-fee report**; account drawer: plan, installments, `PaymentHistory` | finance, ops (view+discount approve), founder | record payment (receipt from counter), reversing entry, apply discount (approval flow) |
| S41 | Communications | `/communications` | Global log + per-record filtered views; send dialog (template picker) | all (scoped, Doc 04) | send templated message (creates log doc first, FR-10.3) |
| S42 | Reports centre | `/reports` | Report catalogue per Phase 11 (daily/weekly/monthly sets); parameterized runs; export | founder, ops full; others scoped | run, export (audited) |

## Administration

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| S50 | Users | `/admin/users` | `UserManagementTable`: role, status, last login | system_admin (founder view) | provision (`InviteUserDialog`, email-link flow), change role, disable |
| S51 | Roles & permissions | `/admin/roles` | Read-only matrix render of the code permission map + map version (C-1) | system_admin, founder | — (changes are PRs by design, ADR-011) |
| S52 | Audit logs | `/admin/audit-logs` | Filterable stream (virtualized); SOP 17.16 register presets; entity drill-down | system_admin, founder | export (audited) |
| S53 | Settings | `/admin/settings` | Org info, ID formats, notification templates | system_admin | edit (audited) |

## Growth Partner Management (GPMS, Doc 25/ADR-014)

Staff oversight screens (gated by the `growthPartners`/`rewards` RBAC modules, Doc 04):

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| S60 | Growth Partners | `/growth-partners` | Partner directory: status, leadership level, referral stats | founder, system_admin, ops_manager (view) | approve/reject (`decideGrowthPartner`), suspend/reactivate |
| S61 | Growth Partner detail | `/growth-partners/[partnerId]` | Profile, referred leads, reward ledger, wallet balance | founder, system_admin, ops_manager (view) | decide status |
| S62 | Reward Rules | `/rewards` | `rewardRules` list: programme scope, flat/percent, active flag | founder, system_admin (configure); finance (view) | create/edit/deactivate rule |
| S63 | Payouts | `/payouts` | `payoutRequests` queue: requested → approved → paid | founder, finance (approve) | approve/reject payout |

Partner portal — separate shell, no access to any staff screen above (`requirePartnerSession()`, ADR-014):

| # | Screen | Route | Purpose · Key elements | Roles | Actions |
|---|---|---|---|---|---|
| P01 | Partner login | `/partner/login` | Email/password via partner session endpoint | growth partner | sign in |
| P02 | Partner dashboard | `/partner/dashboard` | Own referral stats, wallet balance, leaderboard | growth partner | navigate |
| P03 | My leads | `/partner/leads` (+`[leadId]`) | Own referred leads only (`partnerId` row-scope), status | growth partner | submit referral, view status |
| P04 | My rewards | `/partner/rewards` | Own `rewardLedger` entries, wallet, payout request | growth partner | request payout |
| P05 | Notifications | `/partner/notifications` | `partnerNotifications/{partnerId}/items` | growth partner | mark read |
| P06 | Profile | `/partner/profile` | Own profile edit (`updateOwnProfile`) | growth partner | edit |

## Screen Dependencies (build-order constraints)

- S01, S03, S50–S53 have no business-data dependencies → Milestone 1.
- S10–S15 depend only on catalogue (S22 minimal) → Milestone 2; S14 additionally needs S23 (batch pick) and fee plan defaults.
- S21 grows tab-by-tab across milestones — it ships in M3 with Overview/Enrolments/Timeline and gains tabs as modules land (explicitly not blocked on all modules).
- S42 is last (M8) — it consumes every feature's exported read models.
- S60–S63 and P01–P06 (GPMS) depend on M3 (participants) and M7 (fee/payment recording) for reward computation, but not on any other M8 deliverable — shipped independently, 2026-07-26.
