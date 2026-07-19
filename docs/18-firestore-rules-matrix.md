# 18 — Firestore Rules Matrix

**TerraNext Business OS · Architecture Hardening**
Per-collection access truth table. This document is the human-readable contract the generated rules (C-1 codegen) and their emulator tests must match — every row implies both allow **and** deny test cases (Doc 13 S-4).

**Legend:** role keys per Doc 04 · `AdminSDK` = server actions/Functions only (client `write: false`) · Export is an application-layer action (audited, `module:export`) — listed for completeness; Firestore has no export op. `delete` = literal Firestore delete — **`false` on every collection for every principal** (ADR-009); omitted from rows below.

## Global preconditions (all client ops)

`isStaff()` = authenticated ∧ token has valid role claim ∧ `users/{uid}.status == 'active'` is enforced at session layer (not per-rule `get()` — cost) ∧ App Check valid. All reads implicitly exclude soft-deleted docs at query layer; rules additionally deny updates to docs where `deletedAt != null` (except the un-delete path, system_admin).

| Collection | Read | Create | Update | Export | Special conditions |
|---|---|---|---|---|---|
| `users` | self; founder, system_admin: all | AdminSDK (provisionUser) | AdminSDK; self may update `photoUrl` only | system_admin | role/status fields never client-writable |
| `settings/*` | all staff | AdminSDK | AdminSDK (system_admin caller) | — | `settings/roles` written by CI codegen only |
| `counters/*` | AdminSDK | AdminSDK | AdminSDK | — | transaction-only |
| `auditLogs` | founder, system_admin | staff (batch-coupled, `actorUid == auth.uid`, valid shape; `reason` required if action=`override`) + AdminSDK | **false — everyone** | system_admin (audited) | immutability absolute (ADR-007) |
| `academies`, `programmes` | all staff | ops_manager, coordinator (programmes); AdminSDK ok | same as create; `certificateRules` changes audited | — | archive via `status`, no delete |
| `batches` | all staff (trainer: assigned enrich client-side; reads allowed — non-sensitive) | ops_manager, coordinator | ops_manager, coordinator; `enrolledCount` AdminSDK-only (`unchanged` for clients) | — | capacity invariant lives in allocation transaction (BR-04) |
| `batches/*/sessions` | all staff | coordinator; trainer if `batch.trainerUid == uid` | same; `status→held` sets heldAt | — | trainer scope via `get(batch)` |
| `…/sessions/*/attendance` | staff with attendance:view; trainer if assigned | trainer (assigned, `markedBy == uid`, enum status, session is today±1d); coordinator | coordinator; trainer same-day correction only | ops, founder | one of the few client-write paths (ADR-008); collection-group read rules mirror |
| `leads` | founder, ops (all); consultant (all-read, update own-assigned) | ops, consultant (walk-in; consent block required); AdminSDK (createLead) | ops (all fields); consultant (assigned: stage, follow-up, notes fields only); `participantId` `unchanged` for all clients | ops, founder | stage enum validated; `stage=lost` requires lostReason |
| `leads/*/activities` | as parent lead read | staff who can read parent (`byUid == uid`) | **false** (append-only) | — | — |
| `counsellingSessions` | consultant, ops, founder | consultant (`consultantUid == uid`) | consultant (own, same-day); ops | — | outcome=`recommended` requires recommendation ≠ null (BR-02 shape) |
| `colleges` (+campusLeaders) | ops, consultant, founder | ops | ops; consultant (leaders only) | — | — |
| `participants` | staff per field-scope (server projection; rules grant role-based read) | **AdminSDK only** (convertLead — BR-01) | ops (personal/tags); AdminSDK for status/lifecycle | ops, founder | `leadId`, doc id immutable |
| `participants/*/enrolments` | as participant | AdminSDK (allocation transaction) | AdminSDK (roll-ups, status) | — | display-only roll-ups (C-2) |
| `participants/*/timeline` | as participant | AdminSDK + staff append (validated shape) | **false** (append-only) | — | — |
| `participants/*/documents` | staff with participants:view | AdminSDK (upload ticket action) | AdminSDK (finalize trigger status) | — | storagePath must match metadata (Doc 10 §6) |
| `assessments` (+scores) | coordinator, trainer (assigned), ops, founder, placement (view) | coordinator; trainer (assigned) | score entry: trainer (assigned, until batch completed), coordinator; `result` computed server-side | — | score ≤ maxScore in rules |
| `certificates` | all staff | **AdminSDK only** (BR-03 recompute) | AdminSDK (revoke: ops approve + override reason) | ops, founder | criteria snapshot immutable |
| `careerProfiles` (+guidanceSessions) | placement, ops, founder; participant-scoped fields to others per projection | placement | placement; eligibility change requires evaluatedBy/At/note together (BR-09) | placement, founder | — |
| `employers` | placement, ops, founder (others view) | placement | placement | — | — |
| `placements` | placement, ops, founder | **AdminSDK** (eligibility gate BR-09) | placement (status advance via action); `feeDisclosure.terranextFeePaise == 0` always (BR-08) | placement, founder | statusHistory append-shape validated |
| `alumniRecords` | ops, founder, placement, coordinator | **AdminSDK** (trigger BR-05; override system_admin + reason) | ops (engagement, consent — audited) | ops, founder | — |
| `feeAccounts` | finance, ops, founder | **AdminSDK** (created with enrolment) | **AdminSDK** (payment transaction maintains balances); discount path requires approver role in action | finance, founder | clients never write amounts (threat T-2, Doc 10 §5) |
| `feeAccounts/*/payments` | finance, ops, founder | **AdminSDK** (recordPayment) | **false** (append-only ledger; corrections = reversing entries) | finance, founder | receiptNo from counter |
| `communications` | staff per Doc 04 scope | AdminSDK (send pipeline) + staff manual-log create (`byUid == uid`) | AdminSDK (status transitions queued→sent/failed) | ops, founder | log-before-send (FR-10.3) |
| `stats/*` (M8) | all staff (role-scoped docs) | AdminSDK (triggers) | AdminSDK | — | display aggregates only |

## Deny-test obligations (CI)

For each row, the generated test suite must include at minimum: (1) unauthenticated read+write denied; (2) each role **not** listed denied per op; (3) delete denied for **every** role on every collection; (4) immutable-field update denied (`participantId`, `leadId`, `criteria`, `terranextFeePaise`); (5) audit `update`/`delete` denied for system_admin specifically (the "even admins" case); (6) trainer cross-batch attendance write denied.
