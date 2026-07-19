# 19 — Cloud Function Inventory

**TerraNext Business OS · Architecture Hardening**
Every server-side function (Cloud Functions + the server actions that share the privileged tier, ADR-008). Contracts (schemas, error shapes) in Doc 20. All functions: structured logging (Doc 08 §7), audit per column, idempotency stated. Region: `asia-south1`. Split rule: user-session mutations = Next.js server actions; website-facing endpoints, triggers, schedules = Cloud Functions.

## 1. Callable / HTTPS Functions

| Function | Trigger | Caller / Permission | Input → Output | Errors | Audit |
|---|---|---|---|---|---|
| `createLead` | HTTPS POST | Public website (App Check + rate limit per IP & phone; no auth) | Website form payload → `{leadId, dedup: boolean}` | `validation` (malformed only — business oddities are quarantined, never rejected, BR-07) | `create` lead as actor `system`, context `website` |
| `provisionUser` | Callable | system_admin | `{email, displayName, phone, role, assignedBatchIds?}` → `{uid}` | `validation`, `permission`, `conflict` (email exists) | `permission_change` (provision) |
| `setUserRole` | Callable | system_admin | `{uid, role, assignedBatchIds?}` → `{ok}` | `permission`, `not_found`, `precondition` (cannot demote last system_admin) | `permission_change` + token revocation logged |
| `setUserStatus` | Callable | system_admin | `{uid, status}` → `{ok}` | as above; cannot disable self | `permission_change`; disable revokes refresh tokens |
| `verifyCertificate` | HTTPS GET | Public (rate-limited) | `?no=TNXC-…&hash=` → `{valid, programmeName, issuedAt}` (no PII) | `not_found` → generic invalid | `export`-class access log (aggregate count only) |

## 2. Privileged Server Actions (Next.js, Admin SDK — same trust tier)

| Action | Permission | Transaction contents | Errors | Audit |
|---|---|---|---|---|
| `convertLeadAction` | ops_manager (`admissions:create`) | BR-02 check (counselling outcome) → BR-01 dedupe (phone/email vs participants) → counter increment → create participant + enrolment + feeAccount → BR-04 capacity check + `enrolledCount`++ → lead.stage=`admitted`, lead.participantId set | `precondition(BR-02)`, `conflict` (duplicate participant → returns match for link-flow; capacity race) | `create` participant + `status_change` lead (one batch) |
| `allocateBatchAction` | coordinator/ops (`batches:assign`) | capacity check + enrolment batch set + counts (BR-04) | `conflict` (full) | `update` enrolment |
| `issueCertificateAction` | coordinator initiate, ops approve exceptions (`certificates:*`) | **recompute attendance % + assessment results from raw docs (C-2)** → threshold check (BR-03) → counter → create certificate with evidence snapshot | `precondition(BR-03)` with per-criterion detail | `create` certificate; exception path `override`+reason |
| `revokeCertificateAction` | ops_manager approve | status→revoked + reason | `precondition` (already revoked) | `override` |
| `evaluateEligibilityAction` | placement (`career:update`) | BR-09 evaluation fields set atomically | `validation` | `update` careerProfile |
| `createPlacementAction` | placement | BR-09 gate (profile eligible) → create with BR-08 zero-fee disclosure | `precondition(BR-09)` | `create` |
| `recordPaymentAction` | finance (`fees:create`) | receipt counter → payment doc → balance/paid/installment status recompute in-transaction | `validation` (amount > balance policy check), `conflict` | `create` payment (ledger) |
| `applyDiscountAction` | finance initiate + ops/founder approve | discount + approver + plan recompute | `permission` (approver rank) | `override` with reason |
| `sendCommunicationAction` | per-role comm scope | create `communications` doc (`queued`) → enqueue provider task | `validation` (template/vars) | doc itself is the log (FR-10.3) |
| `requestUploadTicketAction` / `issueDownloadUrlAction` | `participants:update` / `:view` | metadata doc + signed URL (Doc 10 §6) | `validation` (size/type), `permission` | `create` document / `export` on download |

## 3. Firestore Triggers

| Function | Trigger | Behavior | Idempotency |
|---|---|---|---|
| `onCertificateIssued` | `certificates/{id}` create | BR-05: create `alumniRecords/{participantId}` if absent; set participant status when final active enrolment completed; enqueue notification | existence check before create; safe on re-fire |
| `onAttendanceWrite` | attendance doc write | Recompute enrolment `attendancePct` from full session set (not incremental — self-healing); update `stats` | full recompute = naturally idempotent |
| `onScoreWrite` | scores write | Recompute `assessmentSummary` on enrolment | full recompute |
| `onUploadFinalize` | Storage finalize | Verify object ↔ metadata doc (path/size/type); status `ready` or delete + `rejected` | keyed by storagePath |
| `onLeadCreate` | leads create | Enqueue acknowledgement communication (website source); notify assignee | communications doc keyed by leadId+template — dedupe check |

## 4. Scheduled Functions

| Function | Schedule | Behavior |
|---|---|---|
| `markOverdueInstallments` | daily 01:00 IST | `pending` installments past dueDate → `overdue`; refresh `nextDueDate`; feeds pending-fee alerts |
| `followUpDigest` | daily 08:00 IST | Per-assignee digest of today's `nextFollowUpAt` leads → communications (internal) |
| *(reserved)* `retentionSweep` | — | Not built until Record Retention Register approved (ADR-009) |

## 5. Cross-Cutting Standards

- **Error handling:** all callables/actions return `Result` envelopes (Doc 20 §1); triggers catch-and-log with dead-letter path (failed trigger writes `systemEvents` doc for ops visibility) — a silent trigger failure is the worst failure mode this design has, so every trigger failure is observable.
- **Cold starts:** `convertLeadAction`/`recordPaymentAction` run in-process (server actions — no cold start); `createLead` gets `minInstances: 1` at go-live.
- **Never in any function:** hard deletes, unaudited business mutations, client-supplied uid/role trust.
