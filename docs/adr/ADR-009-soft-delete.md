# ADR-009 — Why Soft Delete?

Status: **Accepted** · Date: 2026-07-19

## Context
Participant, lead, and financial records are Confidential-class data (SOP 17.6) with retention obligations (Record Retention & Document Disposal Registers, SOP 17.16). BR-06 requires attributable change history. A hard delete destroys exactly what those controls exist to preserve — and in a lifetime-record system (BR-01), "deleted participant" is close to a contradiction.

## Decision
No business document is ever hard-deleted by the application. Deletion = `deletedAt`/`deletedBy` set (audited as `soft_delete`); queries filter `deletedAt == null`; rules deny `delete` on all business collections to **all** clients including admins. Only a future scheduled retention Function may purge, per approved retention policy, writing a Disposal audit entry first.

## Alternatives Considered
1. **Hard delete with audit record of the deletion** — rejected: the audit says *that* data existed, not *what* it was; irreversible operator mistakes; breaks referential expectations (enrolments pointing at a vanished participant).
2. **Move-to-archive collection** — rejected: doubles every query surface and rules block; `deletedAt` achieves the same visibility split in place.
3. **TTL-based auto-expiry per collection** — rejected as primary mechanism: retention periods aren't defined yet (open question, Doc 03 §8); TTL becomes a tool the retention Function may use later, not a policy by default.

## Pros
Recoverable mistakes; retention/disposal becomes deliberate policy, not an app behavior; referential integrity of the lifetime record preserved; catalogue entities get `archived` status instead, keeping history renderable.

## Cons
Every query must carry the `deletedAt == null` filter — mitigated structurally: the repository helpers apply it by default and indexes lead with it (Doc 11 §2), so forgetting is hard; storage grows monotonically (cheap; purge path reserved); "delete" in the UI must be honest wording ("Archive/Remove from lists") to match behavior.

## Long-Term Impact
When data-protection subject-erasure requests become relevant (portals, international operation), the answer is the retention Function + crypto-shredding of Storage objects — policy work, not schema rework. The disposal audit trail satisfies SOP register requirements from day one.
