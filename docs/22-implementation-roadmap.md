# 22 — Implementation Roadmap

**TerraNext Business OS · Architecture Hardening**
Milestones sequenced by the dependency graph (Doc 01 §5, Doc 16 build-order). Complexity: S/M/L/XL (relative engineering effort — deliberately not calendar estimates; a solo-builder cadence makes duration a function of availability, and complexity is the honest unit). Every milestone ends with: self-review, blueprint/doc updates, risk-register pass, and user acceptance against the criteria below.

---

## M1 — Foundation Platform *(complexity: L)*

**Objectives:** the substrate every module needs — auth, RBAC, audit, shell, design system, CI, environments.
**Deliverables:** CRM scaffold (Doc 02 structure); Firebase wiring + **staging project (C-3)**; login + session middleware + email-link first-login + MFA enrollment (enforced roles per Doc 10); RBAC map + claims Functions + guards + `useCan`; **rules codegen + CI drift-check (C-1)**; `withAudit` plumbing; AppShell + core primitives (Doc 17 §1–2 subset); User Management screen (S50) end-to-end; rules + emulator deny-tests (Doc 18 obligations); CI pipeline (Doc 09 §6); ADR-001…012 committed; idle-timeout re-auth for high-privilege surfaces ✅ *(M1-B, Doc 10 §1a)*.
**Dependencies:** none (brand-independent — provisional tokens).
**Acceptance:** admin provisions a user by email link; new user logs in, sees role-scoped nav; role change reflects ≤1h (immediately on disable); every mutation visible in audit screen; all rules deny-tests green; deploy to staging via CI.
**Risks:** RR-01, RR-06, RR-07 all close here — this is the highest-leverage milestone.

## M2 — Acquisition: Leads · Counselling · Colleges · Website Intake *(L)*

**Objectives:** BR-07 live — no enquiry ever lost; the follow-up machine running.
**Deliverables:** leads list/board/detail (S10–S11), activities, assignment, follow-up queue + digest; counselling module (S12); colleges + campus leaders (S15); minimal catalogue admin (academies/programmes — S22 subset) as picklist dependency; **`createLead` Function + website `/apply` integration** (contract Doc 20 §2, App Check + rate limits); communications log (manual + acknowledgement pipeline, FR-10.3).
**Dependencies:** M1. Client inputs due: programme catalogue content, consent text (legal), acknowledgement template (RR-14).
**Acceptance:** website submission appears as lead ≤5s with consent recorded; duplicate phone dedupes to activity entry; consultant records BR-02-complete session; follow-up digest arrives; every send logged.
**Risks:** website coordination (ADR-002 contract discipline); spam (S-3 honeypot first).

## M3 — Admissions & Participant Core *(L)*

**Objectives:** BR-01 and BR-02 live — the lifetime record exists.
**Deliverables:** admissions queue + conversion Stepper (S13–S14) with duplicate-resolution flow; `convertLead` transaction (Doc 19); participant directory + profile shell (S20–S21: Overview, Enrolments, Timeline, History tabs); fee account auto-creation; batch entity + capacity model (S23 minimal, BR-04).
**Dependencies:** M2 (leads, counselling, catalogue). Client inputs: fee plans per programme, Participant ID format sign-off (`idFormats`).
**Acceptance:** BR-02 block demonstrably prevents conversion (UI + forced server test); duplicate phone surfaces link-flow; conversion mints sequential IDs under concurrent attempts (emulator race test); capacity race loses cleanly with `conflict`; audit trail shows full chain.
**Risks:** RR-02 groundwork (enrolment roll-up fields display-only from day one).

## M4 — Academic Delivery: Batches · Attendance · Assessments *(L)*

**Objectives:** daily academic operations digitized; trainer experience mobile-first.
**Deliverables:** batch workspace (S24: roster, sessions, virtualized attendance grid); trainer-scoped client attendance writes + rules (Doc 18); attendance roll-up trigger + risk report (S25); assessments + score entry (S26); trainer dashboard widgets.
**Dependencies:** M3. Client input: **escalation-rule workshop output (RR-03) — blocks alert automation, not attendance capture.**
**Acceptance:** trainer marks a 30-roster session on mobile in under 2 minutes; cross-batch trainer write denied (rules test); roll-up self-heals after simulated trigger replay; risk report flags below-threshold participants.
**Risks:** RR-16 (trigger observability lands with dead-letter here).

## M5 — Certificates & Alumni *(M)*

**Objectives:** BR-03 and BR-05 live end-to-end.
**Deliverables:** eligibility queue + issuance with in-transaction recompute (**C-2 verification tests are the acceptance core**); certificate registry, revocation (override+reason); `verifyCertificate` public endpoint; `onCertificateIssued` trigger → alumni records (S27, S33); alumni consent flags feeding website success-stories pipeline (consent-gated per Phase 04).
**Dependencies:** M4 (attendance/assessment data). Client input: certificate visual template, `certificateRules` per programme confirmed.
**Acceptance:** participant below threshold cannot be issued (server-forced test bypassing UI); stale roll-up + accurate raw data ⇒ correct decision (the C-2 test); issuance auto-creates alumni record exactly once under trigger re-fire; public verify returns no PII.
**Risks:** RR-02 closes here.

## M6 — Career & Placement *(M)*

**Objectives:** BR-08 and BR-09 live; the selective placement pipeline.
**Deliverables:** career profiles + interest capture + eligibility evaluation flow (S30); guidance session log; employers directory (S32); placements board with stage history (S31); BR-08 zero-fee structural enforcement + disclosure rendering.
**Dependencies:** M3 (participants); M5 optional (placement often post-certification but not gated).
**Acceptance:** placement creation blocked for non-evaluated profile (BR-09 test); `terranextFeePaise ≠ 0` write denied at rules layer; pipeline report shows evaluated→eligible→placed funnel.
**Risks:** RR-17 tripwire active; eligibility-communication template wording (Ops sign-off).

## M7 — Fees & Collections *(M)*

**Objectives:** complete money story on the append-only ledger.
**Deliverables:** fee accounts UI + pending-fee report (S40); `recordPayment` with receipt numbering; reversing-entry corrections; discount approval flow; overdue scheduler + fee-reminder communications; finance dashboard widgets.
**Dependencies:** M3 (accounts exist from conversion). Client inputs: receipt format/FY convention, reminder templates, **gateway decision (RR-05) — webhook adapter only if resolved; manual collection fully functional regardless.**
**Acceptance:** installment sums always reconcile (property test); balance arithmetic exact under concurrent payments (transaction test); receipt sequence gapless per FY; discount without approver rank denied; overdue flip verified on staging clock run.
**Risks:** RR-11 (counter recipe on standby).

## M8 — Reports, Dashboards & Hardening → Go-Live *(L)*

**Objectives:** leadership visibility (SOP 18); production readiness (Phase 15/16 obligations).
**Deliverables:** report centre (S42) covering SOP 18.7 daily/weekly/monthly sets + Academy §21 business reports; `stats` aggregation triggers; founder KPI dashboard (SOP 18.10) completed; export-with-audit everywhere; performance pass vs budgets (Doc 11 §8: Lighthouse CI, read-amplification audit); security pass (rules coverage re-run, pen-check of public endpoints); UAT script against FR-01…FR-10 → **UAT Sign-Off Report (BRD §29 deliverable)**; go-live runbook + incident SOP page (17.14); hypercare monitoring (budget alerts, error reporting, `systemEvents` review cadence).
**Dependencies:** all prior. Client inputs: UAT participants scheduled, report recipients confirmed.
**Acceptance:** every FR row traced to a passing UAT case; founder dashboard live-accurate vs manual tally on staging seed; rollback rehearsed (Doc 09 §6); hypercare checklist signed.
**Risks:** RR-09 process control activates; RR-12 mitigated by complete docs.

---

## Post-launch (sequenced but unscheduled)
Escalation automation (from RR-03 workshop) → notification rule engine (Phase 10 deep-dive) → search upgrade (RR-10) → gateway integration (RR-05) → BigQuery reporting mirror (ADR-003) → portals per Doc 12.

## Standing Rule
Every feature inside every milestone follows the full cycle: Requirement → Business Analysis → Architecture Review → Database Design → Security Review → UI/UX Design → Implementation → Testing → Self Review → Documentation Update → Commit. No bypass (working agreement; enforced by PR template, Doc 09 §4).
