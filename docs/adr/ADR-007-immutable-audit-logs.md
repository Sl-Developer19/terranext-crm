# ADR-007 — Why Audit Logs Are Immutable?

Status: **Accepted** · Date: 2026-07-19

## Context
BR-06: every Participant Profile change must be attributable to an authenticated user via an audit log. SOP 17.16 requires security registers (access, incidents, disposal) built on the same trail. An audit log that can be edited is testimony that can be coached.

## Decision
`auditLogs` documents are **create-only for everyone, forever**: rules deny `update` and `delete` unconditionally — including `system_admin` and the Admin SDK paths by convention (no code path performs them). Corrections are new compensating entries referencing the original.

## Alternatives Considered
1. **Admin-editable logs ("fix mistakes")** — rejected: an editable audit log fails its one job (non-repudiation, Doc 10 threat model "Repudiation").
2. **External log sink (BigQuery/Cloud Logging) as the audit store** — rejected as primary: staff-facing audit screens and per-record trails need queryable, security-ruled data co-located with the records; Cloud Logging retention is operational (30–90d), not archival. BigQuery export remains the *analytical* mirror later.
3. **Snapshot-versioning every document instead of diff logs** — rejected: storage-heavy, and reconstructing "who changed what" from snapshots is worse than storing the diff directly.

## Pros
Non-repudiation by construction; investigation substrate for SOP 17.14 incident workflow; append-only writes are cheap and contention-free; the trail doubles as the participant `timeline` source for lifecycle display.

## Cons
Volume — largest collection by an order of magnitude (Doc 13 bottleneck 3): storage is cheap, but a retention/archive policy must eventually exist (open question tied to the Record Retention Register); bad entries live forever (compensating-entry convention covers this); client-batched audit writes have the W-3 validation ceiling — which is why client-writable collections stay minimal.

## Long-Term Impact
Immutability is what lets the platform assert compliance posture to partners and future auditors. Portals inherit the same rule: no surface, ever, gets audit mutation rights.
