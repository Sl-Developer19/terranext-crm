# 04 — RBAC Blueprint

**TerraNext Business OS · Architecture Blueprint**
Source: BRD Section 18 · SOP Ch.15.5 · Master Doc Phase 07

---

## 1. Role Model

Eight staff roles (claims value in code):

| Role | Claim | Nature |
|---|---|---|
| Founder & Proprietor | `founder` | Read-everything + strategic reports |
| System Administrator | `system_admin` | Platform control (users, roles, audit, settings) |
| Operations Manager | `ops_manager` | Full operational CRM |
| Transformation Consultant | `consultant` | Acquisition + counselling |
| Programme Coordinator | `coordinator` | Academic delivery |
| Trainer | `trainer` | Assigned batches only (row-level scope) |
| Finance Officer | `finance` | Fees/payments only |
| Career & Placement Officer | `placement` | Career/placement/employers |

**No hierarchy inheritance.** Roles are flat permission sets — `founder` is *not* a superset of `system_admin` (Founder reads everything but does not manage users; System Administrator manages the platform but has no business-approval powers). This avoids the classic "admin can do everything" audit hole.

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
| Users & Roles | view | ✓ | — | — | — | — | — | — |
| Audit Logs | view | ✓E | — | — | — | — | — | — |
| Settings | view | ✓ | — | — | — | — | — | — |

Business-rule anchors: only `ops_manager` converts leads (BR-02 recorded outcome checked in the Function regardless of role); discount approval = `ops_manager` or `founder`, always audited; manual alumni override = `system_admin` only, reason required (BR-05); placement eligibility set only by `placement` role (BR-09).

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
