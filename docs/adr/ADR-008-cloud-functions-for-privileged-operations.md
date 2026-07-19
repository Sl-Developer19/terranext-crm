# ADR-008 — Why Cloud Functions / Admin SDK for Privileged Operations?

Status: **Accepted** · Date: 2026-07-19

## Context
Some operations carry invariants that client-side code plus security rules cannot fully guarantee: minting permanent Participant IDs (BR-01), lead conversion preconditions (BR-02), certificate issuance thresholds (BR-03), capacity-bounded allocation (BR-04), claims management, payment ledger writes. Rules validate document shapes; they cannot orchestrate multi-document transactions with recomputation.

## Decision
All privileged mutations execute **server-side with the Admin SDK** — callable Functions or Next.js server actions — inside transactions, with rules granting clients read-only access to the affected collections. Client-direct writes are the narrow exception (lead activities, attendance marks, notes), each treated as a security decision (Doc 13 W-3).

## Alternatives Considered
1. **Client writes + maximal rules** — rejected: rules can't atomically check counsellng outcome + create participant + increment counter + write audit; "clever rules" become an unmaintainable authorization program.
2. **Everything through Functions (zero client writes)** — considered seriously; rejected for the high-frequency, low-risk paths (attendance marking by trainers benefits from offline-capable client writes with rules validation). Pragmatic middle chosen.
3. **A dedicated API server (Express/Nest)** — rejected: an always-on service to operate; Functions/actions give the same trust boundary serverless.

## Pros
Invariants enforced where the client can't lie; transactions + recomputation at the trust boundary (C-2); audit writes coupled server-side; one place to reason about each business rule's enforcement.

## Cons
Cold-start latency on callables (mitigate: min instances on the hot ones — convertLead, recordPayment); local dev needs the emulator; two runtimes (Next server actions + Functions) — the split rule is: *user-session mutations = server actions; website-facing endpoints, triggers, and schedules = Functions*.

## Long-Term Impact
This is the pattern mobile apps and portals plug into — same callables, same contracts (Doc 20). The API Contract doc exists precisely so these server operations can later be exposed as versioned REST endpoints without redesign.
