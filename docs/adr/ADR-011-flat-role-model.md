# ADR-011 — Why a Flat Role Model (No Hierarchy)?

Status: **Accepted** · Date: 2026-07-19 · Fulfills Doc 13 recommendation (formerly "ADR-002" in the review report)

## Context
Eight staff roles (BRD §18). The intuitive design is a hierarchy: Founder ⊃ System Administrator ⊃ Operations Manager ⊃ … Hierarchies read naturally in org charts and disastrously in permission systems.

## Decision
Roles are **flat, disjoint permission sets** with no inheritance (Doc 04 §1). Founder reads everything but cannot manage users; System Administrator runs the platform but holds no business approvals (discounts, admissions). Overlap happens by explicit grants in the matrix, never by "is above."

## Alternatives Considered
1. **Strict hierarchy with inheritance** — rejected: produces the "admin can do everything" audit hole — a compromised or careless top-role account can silently do *anything*, and separation-of-duties (finance vs approval vs platform) becomes unenforceable.
2. **Permission groups composed per user (RBAC → ABAC drift)** — rejected: eight known roles don't justify a policy engine; auditability of "who can do what" would depend on per-user configuration state instead of one reviewed map.

## Pros
Separation of duties by construction (SOP 17 classification intent); the matrix is the complete, reviewable truth; least-privilege defaults for every role; a leaked Founder credential cannot rewrite roles or rules-relevant config.

## Cons
Some duplication across matrix rows (view grants repeat) — tolerable in one static map; occasional friction when a role needs a one-off power (answer: change the matrix in a reviewed PR, never grant ad-hoc).

## Long-Term Impact
Portal roles and `branch_manager` slot in as new flat rows. If per-branch role *arrays* ever become necessary, that is the claims redesign flagged in ADR-006/R-4 — the flat model itself survives.
