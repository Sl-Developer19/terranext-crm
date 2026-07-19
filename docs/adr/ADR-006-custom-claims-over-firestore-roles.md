# ADR-006 — Why Custom Claims instead of Firestore Role Documents?

Status: **Accepted** · Date: 2026-07-19

## Context
Every request needs the actor's role for authorization at three layers (rules, server, UI — Doc 04 §4). The role could live in the auth token (custom claims) or in a Firestore doc read per check.

## Decision
Role and branch scope live in **Firebase Auth custom claims** (`{ role, branchId }`), set only by the `setUserRole`/`provisionUser` Functions. The `users` doc mirrors them for display and adds row-level data (`assignedBatchIds`, `status`).

## Alternatives Considered
1. **Role in `users/{uid}` doc, rules use `get()`** — rejected as primary: every rules evaluation pays a doc read (cost + latency), and a compromised rules edit on `users` would let users self-elevate; claims are not client-writable under any rules mistake.
2. **Roles collection with grants per user** — flexible many-to-many; rejected: no requirement for multi-role users, and it inherits alternative 1's problems.
3. **Session-server-only roles (no claims, all checks server-side)** — rejected: forfeits rules-layer enforcement entirely, our authoritative layer.

## Pros
Tamper-proof (server-signed token); free at rules-evaluation time (no reads); available identically to middleware, server actions, Functions, and rules; tiny payload (~40 bytes of the 1000-byte limit).

## Cons
Propagation lag: claims changes apply on token refresh (≤1h) — mitigated by per-request `users.status` check in middleware for disables, and token revocation on role change; claims are size-limited — permission *expansion* stays in the static code map (Doc 04 §4), only the role name travels.

## Long-Term Impact
Portal roles (Doc 04 §6) reuse the same mechanism with reserved claim values, so portal authorization is additive. If multi-role-per-user or per-branch role arrays ever become real (Doc 13 R-4), claims need a redesign — the known ceiling, accepted.
