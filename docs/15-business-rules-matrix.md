# 15 — Business Rules Matrix

**TerraNext Business OS · Architecture Hardening**
BR-01…BR-09 (BRD §25 + Academy §6), each mapped across all engineering dimensions. Enforcement code lives in the owning feature's `logic.ts` with the rule id in JSDoc (Doc 08 §8).

---

## BR-01 — One Participant ID for Life

| Dimension | Specification |
|---|---|
| Description | One permanent Participant ID per individual regardless of programme count; re-enrolment never creates a second record (FR-03.3) |
| Affected modules | Admissions, Participants, Leads, every downstream module keyed by participantId |
| Database | `participants/{id}` doc-ID = the ID (counter-issued, `TNX-YYYY-NNNNN`); re-enrolment = new `enrolments/{id}` subdoc; lead dedupe on phone/email pre-conversion (FR-01.4) |
| UI | Conversion flow surfaces potential duplicate matches (phone/email) with "link to existing participant" path; profile shows all enrolments on one timeline |
| Validation | `convertLead` transaction: duplicate check → counter increment → create; `participantId` immutable in rules (`unchanged`) |
| Security | Only `convertLead` (ops_manager) creates participants; ID minting Admin-SDK only (ADR-008) |
| Reports | "100% participants single-record" success metric (Phase 01); duplicate-suspect report (same phone, 2 leads unconverted) |
| Notifications | Admission confirmation to participant (logged, FR-10.3) |
| Future | Portal identity maps Auth user → participantId (`portalAccounts`); ID survives multi-branch (ADR-010: IDs branch-prefixable without collision) |

## BR-02 — No Conversion Without Counselling Outcome

| Dimension | Specification |
|---|---|
| Description | Lead → Participant requires a recorded counselling session with outcome `recommended` + programme recommendation |
| Affected modules | Counselling, Admissions, Leads |
| Database | `counsellingSessions` queried by leadId inside the `convertLead` transaction; recommendation snapshot copied to the enrolment |
| UI | Admissions queue shows BR-02 checklist per lead; Convert button disabled with explanation until satisfied; `precondition` error names the rule (Doc 08 §6) |
| Validation | `canConvertLead(lead, sessions)` in `features/admissions/logic.ts`; re-checked server-side regardless of UI state |
| Security | Consultant records sessions; only ops_manager converts (Doc 04) — two-person flow by role design |
| Reports | Counselling-to-admission conversion rate (weekly, SOP 18.7); leads admitted without counselling = **always-zero integrity check** on the ops dashboard |
| Notifications | Counselling booked/attended reminders (Phase 10 triggers) |
| Future | Escalation rules (R-3 workshop) will add follow-up automation on `follow_up` outcomes |

## BR-03 — Certificate Requires Thresholds Met

| Dimension | Specification |
|---|---|
| Description | No certificate unless attendance % and assessment criteria (per `programmes.certificateRules`) are met |
| Affected modules | Certificates, Attendance, Assessments, Programmes |
| Database | `certificates.criteria` stores the recomputed evidence snapshot; `certificateRules` configurable per programme |
| UI | Eligibility queue shows per-participant progress vs thresholds; issuance is a ConfirmDialog with the evidence displayed |
| Validation | **C-2 (binding):** issuing transaction recomputes from raw attendance/assessment docs; roll-ups (`attendancePct`) are display-only |
| Security | Issuance server-side; exception issuance = ops_manager `approve` + audit `override` with reason |
| Reports | Completion rate, at-risk (attendance below threshold mid-batch) — attendance risk report (Academy §21) |
| Notifications | Certificate-issued notification (Phase 10); at-risk alerts pending escalation workshop |
| Future | Public verification endpoint uses `verifyHash` — partner-facing trust feature |

## BR-04 — No Batch Assignment Beyond Capacity

| Dimension | Specification |
|---|---|
| Description | Batch allocation must respect `capacity` |
| Affected modules | Batches, Admissions, Participants |
| Database | `batches.enrolledCount` maintained in the allocation transaction; check `enrolledCount < capacity` inside the same transaction (no read-then-write race) |
| UI | Batch pickers show `27/30` fill state; full batches selectable only with "waitlist" messaging (waitlist itself = future) |
| Validation | `canAllocate(batch)` + transactional guard; `conflict` error code on race loss |
| Security | Allocation via server action (coordinator/ops_manager) |
| Reports | Batch utilization (weekly Batch Progress, SOP 18.7) |
| Notifications | Batch allocation confirmation to participant |
| Future | Waitlist queue; auto-suggest next batch on overflow |

## BR-05 — Alumni Status Auto-Assigned on Certification

| Dimension | Specification |
|---|---|
| Description | Certificate issuance ⇒ alumni status automatically; Admin override only, logged |
| Affected modules | Certificates, Alumni, Participants |
| Database | `onCertificateIssued` trigger creates `alumniRecords/{participantId}` (idempotent — checks existing) + sets `participants.status = 'alumni'` when final enrolment completes |
| UI | No manual "make alumni" button except admin override dialog (reason required) |
| Validation | Trigger idempotency; override requires `context.reason` (rules-enforced, Doc 03 §6) |
| Security | Override = `system_admin` only; both paths audited |
| Reports | Alumni growth KPI (SOP 18.10) |
| Notifications | Alumni welcome + structured campaigns (FR-08.2) |
| Future | Alumni portal membership keys off this record |

## BR-06 — All Changes Attributable via Audit Log

| Dimension | Specification |
|---|---|
| Description | Every create/update/delete on participant & lead records attributable to an authenticated user (also NFR: user, timestamp, change detail) |
| Affected modules | All — cross-cutting |
| Database | `auditLogs` immutable (ADR-007); diff-based `changes` |
| UI | Per-record History tab (entityPath filter); Admin audit screen with SOP 17.16 register views |
| Validation | `withAudit()` structurally couples writes+audit; unaudited mutation path = review blocker (Doc 09 §5.3) |
| Security | Read: system_admin + founder; no mutation rights for anyone |
| Reports | Access Authorisation & System Access registers; export actions themselves audited |
| Notifications | None (investigation is pull-based; incident workflow SOP 17.14) |
| Future | BigQuery mirror for audit analytics; retention/archive policy pending registers |

## BR-07 — Every Website Registration Creates/Updates a CRM Lead

| Dimension | Specification |
|---|---|
| Description | No website registration discarded; all become Leads (FR-09.2: form fields map 1:1 to Lead) |
| Affected modules | Website (external), Leads, Communications |
| Database | `createLead` HTTPS Function: dedupe on phone/email → create or append `activities` entry ("re-enquiry") to existing lead; consent block required |
| UI | Website form (exists: `/apply`) must post to the Function; CRM lead list badges `source: website` |
| Validation | Zod contract in the Function (Doc 20 §createLead); rejects only on malformed input — never on business grounds (log + quarantine instead) |
| Security | App Check + per-IP/phone rate limit (Doc 10 §5); website has zero Firestore access (ADR-005) |
| Reports | Campaign/college-wise lead source reports; website conversion funnel |
| Notifications | Auto-acknowledgement to registrant (logged in `communications`) |
| Future | Additional website forms (Academy §23: 7 form types) all route through the same Function with a `formType` field |

## BR-08 — No Placement Fees Charged to Students

| Dimension | Specification |
|---|---|
| Description | TerraNext/Globex Union charges no placement fee to student/family; only actual personal costs + transparent lawful third-party fees |
| Affected modules | Placements, Fees, Website (public policy page) |
| Database | `placements.feeDisclosure.terranextFeePaise` — literal `0`, rules-constrained; third-party costs are free-text disclosure, never ledger entries |
| UI | Placement record displays the zero-fee disclosure; fee module structurally cannot attach a placement-typed charge |
| Validation | Rules: `feeDisclosure.terranextFeePaise == 0`; no fee-account linkage from placements |
| Security | Any attempt is a rules denial — logged pattern worth alerting on (integrity signal) |
| Reports | Placement pipeline report includes disclosure completeness |
| Notifications | Disclosure included in placement-stage communications |
| Future | Employer portal must show the same policy; multi-country legal review may extend disclosure fields |

## BR-09 — Placement Support Is Selective, Never Automatic

| Dimension | Specification |
|---|---|
| Description | Eligibility based on discipline, communication, readiness, profile quality, documentation, fit — not enrolment |
| Affected modules | Career, Placements |
| Database | `careerProfiles.eligibility` defaults `not_evaluated`; `eligible` requires evaluatedBy/At/note (Doc 14 §14); placements creation gated on `eligible` |
| UI | Eligibility is an explicit evaluation action with criteria checklist; participants list shows eligibility as evaluated state, never inferred |
| Validation | `canCreatePlacement(profile)` precondition; rules require eligibility fields set together |
| Security | Only `placement` role evaluates (Doc 04 §3); evaluations audited |
| Reports | Placement-support pipeline report (Academy §21): evaluated / eligible / placed funnel |
| Notifications | Eligibility outcome communicated per template (sensitive wording — Ops to approve template) |
| Future | Readiness score may become model-assisted (Doc 12 §4) — but eligibility remains a human, audited decision by policy |
