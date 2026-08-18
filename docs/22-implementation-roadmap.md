# 22 — Implementation Roadmap

**TerraNext Business OS · Architecture Hardening**
Milestones sequenced by the dependency graph (Doc 01 §5, Doc 16 build-order). Complexity: S/M/L/XL (relative engineering effort — deliberately not calendar estimates; a solo-builder cadence makes duration a function of availability, and complexity is the honest unit). Every milestone ends with: self-review, blueprint/doc updates, risk-register pass, and user acceptance against the criteria below.

> **Reconciliation note (2026-07-26).** This doc's milestone notes had gone stale — the M2 progress note below (dated 2026-07-21) originally described only a lead-management vertical slice, but git history shows the *full* feature set through M7 was committed 2026-07-21→2026-07-22, one deliverable per commit, each with schema/repository/logic/actions/components/tests. Status line added to each milestone below reflects actual shipped state as of this reconciliation, verified against code, not just the original plan text (kept for historical context).

---

## M1 — Foundation Platform *(complexity: L)* — **Status: Shipped**

**Objectives:** the substrate every module needs — auth, RBAC, audit, shell, design system, CI, environments.
**Deliverables:** CRM scaffold (Doc 02 structure); Firebase wiring + **staging project (C-3)**; login + session middleware + email-link first-login (~~MFA enrollment~~ — implemented then **withdrawn by owner decision 2026-07-21**, Doc 10 §1); RBAC map + claims Functions + guards + `useCan`; **rules codegen + CI drift-check (C-1)**; `withAudit` plumbing; AppShell + core primitives (Doc 17 §1–2 subset); User Management screen (S50) end-to-end; rules + emulator deny-tests (Doc 18 obligations); CI pipeline (Doc 09 §6); ADR-001…012 committed; idle-timeout re-auth for high-privilege surfaces ✅ *(M1-B, Doc 10 §1a)*.
**Dependencies:** none (brand-independent — provisional tokens).
**Acceptance:** admin provisions a user by email link; new user logs in, sees role-scoped nav; role change reflects ≤1h (immediately on disable); every mutation visible in audit screen; all rules deny-tests green; deploy to staging via CI.
**Risks:** RR-01, RR-06, RR-07 all close here — this is the highest-leverage milestone.

## M2 — Acquisition: Leads · Counselling · Colleges · Website Intake *(L)* — **Status: Shipped**

> **Progress note (2026-07-21, speed-with-quality pivot):** core lead management (S10 table view, S11 detail/activity/stage/assignment, row-level scope, RBAC, rules, tests) shipped as a vertical slice ahead of counselling/colleges/website-intake. **Superseded 2026-07-21/22:** counselling (S12), colleges + campus leaders (S15), catalogue admin, `createLead` Function, and communications log all shipped in the same burst. Remaining open items are S10/S11 fast-follows only (kanban toggle, filter set, export, consent-record display, counselling-history tab) — see Doc 16 §S10/S11.

**Objectives:** BR-07 live — no enquiry ever lost; the follow-up machine running.
**Deliverables:** leads list/board/detail (S10–S11), activities, assignment, follow-up queue + digest; counselling module (S12); colleges + campus leaders (S15); minimal catalogue admin (academies/programmes — S22 subset) as picklist dependency; **`createLead` Function + website `/apply` integration** (contract Doc 20 §2, App Check + rate limits); communications log (manual + acknowledgement pipeline, FR-10.3).
**Dependencies:** M1. Client inputs due: programme catalogue content, consent text (legal), acknowledgement template (RR-14).
**Acceptance:** website submission appears as lead ≤5s with consent recorded; duplicate phone dedupes to activity entry; consultant records BR-02-complete session; follow-up digest arrives; every send logged.
**Risks:** website coordination (ADR-002 contract discipline); spam (S-3 honeypot first).

## M3 — Admissions & Participant Core *(L)* — **Status: Shipped**

**Objectives:** BR-01 and BR-02 live — the lifetime record exists.
**Deliverables:** admissions queue + conversion Stepper (S13–S14) with duplicate-resolution flow; `convertLead` transaction (Doc 19); participant directory + profile shell (S20–S21: Overview, Enrolments, Timeline, History tabs); fee account auto-creation; batch entity + capacity model (S23 minimal, BR-04).
**Dependencies:** M2 (leads, counselling, catalogue). Client inputs: fee plans per programme, Participant ID format sign-off (`idFormats`).
**Acceptance:** BR-02 block demonstrably prevents conversion (UI + forced server test); duplicate phone surfaces link-flow; conversion mints sequential IDs under concurrent attempts (emulator race test); capacity race loses cleanly with `conflict`; audit trail shows full chain.
**Risks:** RR-02 groundwork (enrolment roll-up fields display-only from day one).

## M4 — Academic Delivery: Batches · Attendance · Assessments *(L)* — **Status: Shipped**

**Objectives:** daily academic operations digitized; trainer experience mobile-first.
**Deliverables:** batch workspace (S24: roster, sessions, virtualized attendance grid); trainer-scoped client attendance writes + rules (Doc 18); attendance roll-up trigger + risk report (S25); assessments + score entry (S26); trainer dashboard widgets.
**Dependencies:** M3. Client input: **escalation-rule workshop output (RR-03) — blocks alert automation, not attendance capture.**
**Acceptance:** trainer marks a 30-roster session on mobile in under 2 minutes; cross-batch trainer write denied (rules test); roll-up self-heals after simulated trigger replay; risk report flags below-threshold participants.
**Risks:** RR-16 (trigger observability lands with dead-letter here).

## M5 — Certificates & Alumni *(M)* — **Status: Shipped** *(architecture deviation: see below)*

**Objectives:** BR-03 and BR-05 live end-to-end.
**Deliverables:** eligibility queue + issuance with in-transaction recompute (**C-2 verification tests are the acceptance core**); certificate registry, revocation (override+reason); `verifyCertificate` public endpoint; `onCertificateIssued` trigger → alumni records (S27, S33); alumni consent flags feeding website success-stories pipeline (consent-gated per Phase 04).
**Dependencies:** M4 (attendance/assessment data). Client input: certificate visual template, `certificateRules` per programme confirmed.
**Acceptance:** participant below threshold cannot be issued (server-forced test bypassing UI); stale roll-up + accurate raw data ⇒ correct decision (the C-2 test); issuance auto-creates alumni record exactly once under trigger re-fire; public verify returns no PII.
**Risks:** RR-02 closes here.
> **Implementation note (2026-07-26 reconciliation):** `manage-certificate.ts` calls `ensureAlumniRecord` directly from the same server action post-issuance, rather than via a Firestore `onCertificateIssued` trigger as originally planned — `functions/src/index.ts` exports only a scheduled export function, no Cloud Function triggers. This satisfies the acceptance criterion (alumni record created exactly once on issuance) but not the literal trigger-based architecture; flagged here rather than silently left inconsistent with Doc 02's `functions/src/triggers/` folder note.

## M6 — Career & Placement *(M)* — **Status: Shipped**

**Objectives:** BR-08 and BR-09 live; the selective placement pipeline.
**Deliverables:** career profiles + interest capture + eligibility evaluation flow (S30); guidance session log; employers directory (S32); placements board with stage history (S31); BR-08 zero-fee structural enforcement + disclosure rendering.
**Dependencies:** M3 (participants); M5 optional (placement often post-certification but not gated).
**Acceptance:** placement creation blocked for non-evaluated profile (BR-09 test); `terranextFeePaise ≠ 0` write denied at rules layer; pipeline report shows evaluated→eligible→placed funnel.
**Risks:** RR-17 tripwire active; eligibility-communication template wording (Ops sign-off).

## M7 — Fees & Collections *(M)* — **Status: Shipped**

**Objectives:** complete money story on the append-only ledger.
**Deliverables:** fee accounts UI + pending-fee report (S40); `recordPayment` with receipt numbering; reversing-entry corrections; discount approval flow; overdue scheduler + fee-reminder communications; finance dashboard widgets.
**Dependencies:** M3 (accounts exist from conversion). Client inputs: receipt format/FY convention, reminder templates, **gateway decision (RR-05) — webhook adapter only if resolved; manual collection fully functional regardless.**
**Acceptance:** installment sums always reconcile (property test); balance arithmetic exact under concurrent payments (transaction test); receipt sequence gapless per FY; discount without approver rank denied; overdue flip verified on staging clock run.
**Risks:** RR-11 (counter recipe on standby).

## M8 — Reports, Dashboards & Hardening → Go-Live *(L)* — **Status: Partial (~50%)**

**Objectives:** leadership visibility (SOP 18); production readiness (Phase 15/16 obligations).
**Deliverables:** report centre (S42) covering SOP 18.7 daily/weekly/monthly sets + Academy §21 business reports; `stats` aggregation triggers; founder KPI dashboard (SOP 18.10) ✅ *(shipped early, 2026-07-21 — `features/dashboard`, live `count()` aggregates rather than a `stats` precompute; migrate to a scheduled precompute here if the live scan cap (1,000 docs) is reached — **2026-07-26 fix:** the five bounded-scan figures (trainer utilisation, assessment completion, attendance mean, revenue, GP rewards) now carry a `scanCapped` flag surfaced as a `partial` metric with an explicit caveat when the cap is hit, so reaching it is visible to the founder rather than a silent understatement — the precompute migration is still the eventual fix, this only stops it from being invisible until then)*; export-with-audit everywhere; performance pass vs budgets (Doc 11 §8: Lighthouse CI, read-amplification audit); security pass (rules coverage re-run, pen-check of public endpoints); UAT script against FR-01…FR-10 → **UAT Sign-Off Report (BRD §29 deliverable)**; go-live runbook + incident SOP page (17.14); hypercare monitoring (budget alerts, error reporting, `systemEvents` review cadence).
**Dependencies:** all prior. Client inputs: UAT participants scheduled, report recipients confirmed.
**Acceptance:** every FR row traced to a passing UAT case; founder dashboard live-accurate vs manual tally on staging seed; rollback rehearsed (Doc 09 §6); hypercare checklist signed.
**Risks:** RR-09 process control activates; RR-12 mitigated by complete docs.
> **Status detail (2026-07-26 reconciliation):** report centre + audited CSV export and the founder KPI dashboard are shipped and live (`features/reports`, `features/dashboard`, live `count()` aggregates). Still open: Lighthouse CI config, UAT Sign-Off Report against FR-01…FR-10, documented security pen-check pass for the public endpoints (`createLead`, `verifyCertificate`, `registerGrowthPartner`), and the go-live runbook/hypercare checklist. Tracked as the current production-readiness work stream.

## M-GPMS — Growth Partner Management System *(complexity: L)* — **Status: Shipped** *(not originally in this roadmap)*

**Objectives:** external referral partners register, get approved, refer leads through the existing acquisition pipeline unmodified, and earn configurable rewards on admitted+paid referrals — without ever seeing another partner's or the CRM's internal data.
**Deliverables (design: Doc 25, ADR-014):** partner identity + registration + founder/ops approval workflow (`growthPartners`); `registerGrowthPartner` public website intake mirroring `createLead`; parallel `isPartner()` actor-type auth (not a `StaffRole`) with its own session cookie path and partner portal (`/partner/*`: dashboard, leads, lead detail, rewards, notifications, profile); referral linkage via `leads.partnerId`/`partnerName` (additive fields, no forked pipeline); configurable `rewardRules`; append-only `rewardLedger` + transactional `wallets` (+ `wallets/*/transactions`) credited inside the same `recordPayment` transaction; `payoutRequests` approval workflow (finance/founder); `partnerNotifications`; staff oversight screens (`/growth-partners`, `/rewards`, `/payouts`) gated by two new RBAC modules (`growthPartners`, `rewards`) on the existing `Module × Action` matrix.
**Dependencies:** M3 (participants), M7 (fee/payment recording) — reward computation hooks into the existing `recordPayment` transaction rather than a new payments collection.
**Acceptance:** a referral rides the existing leads→counselling→admission→fee pipeline with zero pipeline forking; a partner can only ever read their own `growthPartners`/`wallets`/`rewardLedger`/`leads` rows (row-scope via `partnerId`, rules-enforced); reward accrual and wallet credit happen atomically with payment recording; payout approval is audited.
**Risks:** RR-18 (new, actor-type boundary erosion) — `isStaff()`/`isPartner()` must remain mutually exclusive by construction (ADR-014 §Consequences); any future rule written as a bare `allow read: if isStaff();` with no role list would need re-auditing against partner tokens.
**Docs:** this milestone is designed in Doc 25 and ADR-014; Docs 02/03/04/14/16/18/20 have been reconciled to include it as part of the 2026-07-26 documentation pass.
> **Website integration gap found and fixed (2026-07-26, production-readiness pass):** the marketing website's Growth Partner registration form (`terranext/components/forms/GrowthPartnerForm.tsx`) predated this milestone and posted through the generic `createLead`/`formType: campus_leader` pipeline — it never called `/api/registerGrowthPartner`, so website registrations never created a `growthPartners` doc and never entered the approval workflow at all (silently landing as ordinary leads instead). Fixed by rewiring the form to the correct endpoint and adding `applicationNotes` (optional, ≤1000 chars) to the public intake contract so the form's richer profile fields aren't discarded. See the website repo's own commit for the form change.

---

## Post-launch (sequenced but unscheduled)
Escalation automation (from RR-03 workshop) → notification rule engine (Phase 10 deep-dive) → search upgrade (RR-10) → gateway integration (RR-05) → BigQuery reporting mirror (ADR-003) → portals per Doc 12.

## Standing Rule
Every feature inside every milestone follows the full cycle: Requirement → Business Analysis → Architecture Review → Database Design → Security Review → UI/UX Design → Implementation → Testing → Self Review → Documentation Update → Commit. No bypass (working agreement; enforced by PR template, Doc 09 §4).
