# 04 — RBAC Blueprint

**TerraNext Business OS · Architecture Blueprint**
Source: BRD Section 18 · SOP Ch.15.5 · Master Doc Phase 07

---

## 1. Role Model

Eight staff roles (claims value in code):

| Role | Claim | Nature |
|---|---|---|
| Founder & Proprietor | `founder` | Complete permission set — every module, every action (owner decision, 2026-07-22; see correction below) |
| System Administrator | `system_admin` | Platform control (users, roles, audit, settings) |
| Operations Manager | `ops_manager` | Full operational CRM |
| Transformation Consultant | `consultant` | Acquisition + counselling |
| Programme Coordinator | `coordinator` | Academic delivery |
| Trainer | `trainer` | Assigned batches only (row-level scope) |
| Finance Officer | `finance` | Fees/payments only |
| Career & Placement Officer | `placement` | Career/placement/employers |

**No hierarchy inheritance for the other seven roles** — they are flat permission sets with no implicit superset relationship (e.g. `system_admin` manages the platform but has no business-approval powers). This avoids the classic "admin can do everything" audit hole for every role except one.

**Correction (2026-07-26 reconciliation):** this doc previously described Founder as read-only-plus-strategic-reports and explicitly *not* a superset of `system_admin`. That is no longer accurate. `lib/rbac/permissions.ts`'s `ROLE_PERMISSIONS.founder` is `ALL_PERMISSIONS` — literally every `module:action` pair, including `users:create/update`, `roles:configure`, and every module added in the future — per a dated owner decision (2026-07-22, see the inline comment at that line). The code comment gives the reasoning: enumerating Founder's grants row-by-row would silently omit any future module from Founder's Firestore-rules predicates (the codegen reads this map), producing a split-brain where Founder passes the server-side `can()` check but is refused by Firestore on the same request. So Founder genuinely is a superset of every other role today, by deliberate design — the "no hierarchy" principle above applies to the remaining seven roles, not to Founder.

**Growth Partner is a ninth authenticated actor, but deliberately not a ninth row in this table** (ADR-014, Doc 25). It is a parallel claim namespace — `{ actorType: 'growth_partner', partnerId, status }`, no `role` claim — so `toStaffRole()` never resolves it and every guard above (`isStaff()`, `requirePermission()`) rejects a partner token by construction rather than by an empty permission row. Partner access is entirely row-level (`partnerId == own`), which the `Module × Action` matrix below cannot express and does not attempt to; partners are gated instead by a parallel `isPartner()` rules predicate and `requirePartnerSession()`. See §7.

## 2. Permission Vocabulary

Permissions are `module:action` pairs. Actions:

`view` · `create` · `update` · `delete` (soft) · `assign` · `approve` · `export` · `configure`

Row-level scopes refine a grant: `own` (records assigned to me), `batch` (my assigned batches), `all`.

## 3. Complete Permission Matrix

Legend: ✓ = all · Ⓞ = own/assigned only · A = approve · E = +export · — = none

| Module | founder | system_admin | ops_manager | consultant | coordinator | trainer | finance | placement |
|---|---|---|---|---|---|---|---|---|
| Dashboard | ✓E | ✓ | ✓E | Ⓞ | Ⓞ | Ⓞ | Ⓞ | Ⓞ |
| Leads | view,E | — | ✓E | view,create,update Ⓞ | — | — | — | — |
| Counselling | view | — | view | ✓ | — | — | — | — |
| Admissions (convert) | view | — | ✓ | recommend only | — | — | — | — |
| Participants | view,E | — | ✓E | view | view,update(academic) | view Ⓞ(batch) | view(finance fields) | view(career fields) |
| Programmes/Academies | view | configure | ✓ | view | ✓ | view | view | view |
| Batches | view | — | ✓ | view | ✓ | view Ⓞ | — | view |
| Attendance | view,E | — | view,E | — | view,update | ✓ Ⓞ(batch) | — | view |
| Assessments | view | — | view | — | ✓ | ✓ Ⓞ(batch) | — | view |
| Certificates | view | configure(rules) | view,A(exceptions) | — | view,issue-check | view Ⓞ | — | view |
| Trade & Career Interest | view | — | view | view | — | — | — | ✓ |
| Placements | view,E | — | view | — | — | — | — | ✓E |
| Employers | view | — | view | — | — | — | — | ✓ |
| Alumni | view,E | — | ✓ | view | view | — | — | view |
| Fees & Collections | view,E | — | view + A(discounts) | — | — | — | ✓E | — |
| Communications | view | configure(templates) | ✓ | Ⓞ(own leads) | Ⓞ | Ⓞ(batch) | Ⓞ(fee reminders) | Ⓞ |
| Reports | ✓E | — | ✓E | Ⓞ | Ⓞ | Ⓞ | finance E | placement E |
| Colleges/Campus Leaders | view | — | ✓ | view,update | — | — | — | — |
| Growth Partners *(GPMS)* | ✓,A | ✓,A | ✓,A | — | — | — | view | — |
| Reward Rules *(GPMS)* | view,configure | configure | view | — | — | — | view | — |
| Payouts *(GPMS)* | view,A | — | — | — | — | — | view,A | — |
| Users & Roles | view | ✓ | — | — | — | — | — | — |
| Audit Logs | view | ✓E | — | — | — | — | — | — |
| Settings | view | ✓ | — | — | — | — | — | — |

Business-rule anchors: only `ops_manager` converts leads (BR-02 recorded outcome checked in the Function regardless of role); discount approval = `ops_manager` or `founder`, always audited; manual alumni override = `system_admin` only, reason required (BR-05); placement eligibility set only by `placement` role (BR-09); Growth Partner approve/reject = `founder`, `system_admin`, or `ops_manager` (Doc 25 §2 role mapping); payout approval = `founder` or `finance` only, always audited.

## 4. Enforcement Layers

| Layer | Mechanism | Answers |
|---|---|---|
| 1. Firestore rules | claim checks + field-level validation | "can this write ever happen?" (authoritative) |
| 2. Server (middleware, actions, Functions) | `requirePermission(user, 'leads:update')` | route + action gating |
| 3. UI | `useCan('leads:update', {scope})` + `<RoleGate>` | show/hide affordances |

Claims payload kept minimal (custom-claims 1000-byte limit):
```json
{ "role": "trainer", "branchId": "HQ" }
```
The `module:action` expansion happens from a static `ROLE_PERMISSIONS` map in `lib/rbac/permissions.ts`, mirrored to `settings/roles` for admin visibility. **Phase 1 decision:** the map ships in code (reviewed, versioned); the settings doc is read-only display. Runtime-editable permissions are deferred — editable RBAC without a policy-test harness is a security risk (flagged in Doc 13 review).

Trainer row-level scope: rules compare `request.auth.uid == batchDoc.trainerUid` via a `get()`; UI scope comes from `users.assignedBatchIds`.

## 5. Role Lifecycle

- Provisioning: `system_admin` → `provisionUser` callable → creates Auth user (temp password flow), `users/{uid}` doc, sets claims, writes audit (`permission_change`).
- Role change: `setUserRole` callable → claims + mirror + audit; user's live sessions pick it up on token refresh (≤1h) — middleware also rechecks `users.status` per request for immediate disable.
- Every permission-relevant event lands in the Access Authorisation Register view (filtered `auditLogs`, SOP 17.16).

## 6. Future Role Expansion (reserved, Doc 12)

| Future role | Claim (reserved) | Access pattern |
|---|---|---|
| Student | `portal_student` | self-scoped reads of own participant subtree |
| Parent/Guardian | `portal_parent` | reads of linked child records (family linkage) |
| Employer | `portal_employer` | consented candidate profiles only |
| Branch Manager | `branch_manager` | ops_manager powers scoped by `branchId` |

Design guarantees that make these additive: (a) claims carry `role` + `branchId` from day one; (b) rules are organized per-collection with role predicates in reusable functions — a new role adds predicates, never restructures; (c) portal roles get **separate apps** with the same Firestore (Doc 01), so CRM route guards never need to know about them.

## 7. Growth Partner Actor Type (GPMS, ADR-014) — shipped ahead of the §6 reserved roles

Growth Partner is the first of the "future role" pattern above to actually ship, and it validated the design: it is **not** added to `STAFF_ROLES` or `ROLE_PERMISSIONS`.

| Aspect | Staff (§1–5) | Growth Partner |
|---|---|---|
| Claim shape | `{ role, branchId }` | `{ actorType: 'growth_partner', partnerId, status }` — no `role` |
| Session resolution | `getSession()` / `toStaffRole()` | `getPartnerSession()` / `requirePartnerSession()` (`lib/auth/partner-session.ts`) |
| Rules base predicate | `isStaff()` | `isPartner()` — `request.auth.token.actorType == 'growth_partner'` |
| Access shape | `Module × Action` matrix | Row-level only: `partnerId == resource.data.partnerId` (or `== resource.id` for `growthPartners`/`wallets`) |
| Writes | server actions per permission | **never direct** — all writes Admin-SDK-only server actions, including a partner's own wallet/reward ledger |
| Cookie | `__session` | separate partner session cookie (`PARTNER_SESSION_COOKIE_NAME`), same mint/verify plumbing (`identity-toolkit.ts`, `login-service.ts`) reused as-is |

`isStaff()` and `isPartner()` are mutually exclusive by construction (a token is never both) — this is the property every future GPMS/portal rule must preserve. Staff oversight of partner data (Founder/System Administrator/Operations Manager/Finance) does **not** go through `isPartner()`; it uses the ordinary `growthPartners`/`rewards` module grants in §3's matrix, same as every other module.
