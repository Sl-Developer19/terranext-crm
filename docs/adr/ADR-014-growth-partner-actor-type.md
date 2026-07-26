# ADR-014 — Growth Partner Is a Separate Actor Type, Not a Staff Role

Status: **Accepted** · Date: 2026-07-26 · Growth Partner Management System (GPMS)

## Context

GPMS introduces Growth Partners: external referral partners who authenticate
and see *only their own* leads/rewards/wallet — never another partner's data,
never internal CRM data. Every existing authenticated actor in this system is
internal staff (`StaffRole`, Doc 04 §1, ADR-011), and `isStaff()` is used
throughout `firestore.rules` as a bare base predicate — including on
collections gated by nothing else (e.g. `settings`: `allow read: if isStaff();`).

ADR-011's "Long-Term Impact" note anticipated portal roles "slotting in as new
flat rows," which reads as an invitation to add `growth_partner` to
`STAFF_ROLES`. This ADR deliberately does **not** do that.

## Decision

Growth Partner is a **parallel claim namespace**, not a `StaffRole`:

- Custom claim shape: `{ actorType: 'growth_partner', partnerId, status }` —
  no `role` claim in the `StaffRole` sense, so `toStaffRole()` in
  `lib/auth/session.ts` never resolves a partner token and `getSession()`
  correctly returns `null` for one.
- A parallel `getPartnerSession()` / `requirePartnerSession()` in
  `lib/auth/partner-session.ts`, mirroring `session.ts` / `rbac/require.ts`
  exactly, but reading `actorType`/`partnerId` instead of `role`.
- A parallel Firestore rules predicate `isPartner()` (checks
  `request.auth.token.actorType == 'growth_partner'`), never `isStaff()`.
- Same underlying mechanism otherwise: Firebase Auth, the same session-cookie
  mint/verify path (`identity-toolkit.ts`, `login-service.ts`,
  `edge-session.ts`), the same `/api/session` cookie plumbing — reused as-is,
  per the "reuse existing authentication" mandate.

## Alternatives Considered

1. **Add `growth_partner` to `STAFF_ROLES`, give it an (empty) row in
   `ROLE_PERMISSIONS`.** Rejected: `isStaff()` is depended upon in
   `firestore.rules` as a standalone gate on some collections. Any current or
   future rule written as `allow read: if isStaff();` (no role list) would
   silently start admitting Growth Partners the day this row was added — a
   latent, easy-to-miss privilege escalation. The module/action permission
   matrix (`Module × Action`) is also the wrong shape for partner access,
   which is entirely row-level (`partnerId == own`), not module-scoped.
2. **Separate Firebase project / separate app.** Rejected: massive
   duplication of auth, hosting, and session infrastructure for one new
   actor type; explicitly against "reuse existing architecture."

## Consequences

- `isStaff()` and `isPartner()` are mutually exclusive by construction — a
  token is never both.
- Every new GPMS collection's rules must use `isPartner()` for partner access
  paths and the existing generated `can_*` predicates for staff oversight —
  never bare `isStaff()`/`isPartner()` alone as the only gate when the
  collection holds row-scoped data.
- The staff-side oversight surface (Founder/System Administrator/Operations
  Manager/Finance viewing *all* partners) reuses the existing
  `Module × Action` matrix: two new modules, `growthPartners` and `rewards`,
  added to `lib/rbac/permissions.ts` `MODULES`, flowing through the existing
  C-1 codegen unchanged.
- Role mapping from the GPMS brief onto existing staff roles (no new
  `StaffRole` values introduced): Founder → `founder`; System Admin →
  `system_admin`; Operations Admin → `ops_manager`; Finance → `finance`;
  Admission Team → `ops_manager` (already owns `admissions:*`, matches Doc 04
  §3 exactly — a distinct row would duplicate an existing grant set).
