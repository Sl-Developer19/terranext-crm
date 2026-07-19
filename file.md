# TerraNext Business OS
## Consolidated Master Documentation (High-Level, All Phases)

| | |
|---|---|
| **Document Title** | TerraNext Business OS — Master Documentation |
| **Document Type** | Consolidated Product & Solution Overview (Phases 01–17) |
| **Source Documents** | TerraNext BRD v1.0 (16 Jul 2026) · TerraNex Global Academy CRM/Website Proposal · Volume 2 Part D — CRM & Documentation SOPs (Ch.15–18) |
| **Classification** | Confidential — Internal Use |
| **Version** | 0.1 (Draft — High-Level Consolidated Baseline) |
| **Prepared For** | TerraNext Global Ventures — Project Steering Committee |
| **Status** | Draft — pending phase-by-phase deep-dive documents |

> **How to use this document:** This is a single-file, high-level pass across all 17 documentation phases requested for TerraNext Business OS. Each section below is a compressed version of what a full phase document will eventually contain. Nothing here is generic filler — every statement is traceable to the BRD, the Academy proposal, or the Operations SOPs. Where the source material is silent on a topic (e.g., detailed wireframes, component libraries, CI/CD pipeline specifics), this is flagged explicitly as **"Not yet defined in source material — requires a dedicated Phase document"** rather than invented. Use the Phase-selection conversation to decide which sections get expanded into standalone deep-dive documents next.

---

## Table of Contents

1. [Phase 01 — Vision, Mission & Product Philosophy](#phase-01)
2. [Phase 02 — Business Analysis](#phase-02)
3. [Phase 03 — Enterprise Architecture](#phase-03)
4. [Phase 04 — UX Documentation](#phase-04)
5. [Phase 05 — Design System](#phase-05)
6. [Phase 06 — Database Design](#phase-06)
7. [Phase 07 — Security Documentation](#phase-07)
8. [Phase 08 — Module Documentation (Overview)](#phase-08)
9. [Phase 09 — API Documentation](#phase-09)
10. [Phase 10 — Notification Documentation](#phase-10)
11. [Phase 11 — Reporting Documentation](#phase-11)
12. [Phase 12 — Workflow Documentation](#phase-12)
13. [Phase 13 — Development Standards](#phase-13)
14. [Phase 14 — DevOps Documentation](#phase-14)
15. [Phase 15 — Quality Assurance](#phase-15)
16. [Phase 16 — Deployment Guide](#phase-16)
17. [Phase 17 — Future Roadmap](#phase-17)
18. [Appendix — Glossary & References](#appendix)

---

<a name="phase-01"></a>
## Phase 01 — Vision, Mission & Product Philosophy

**Vision.** TerraNext Global Ventures is building **TerraNext Business OS** — not a lead-capture CRM, but the digital operating backbone connecting marketing, admissions, academic delivery, career services, and alumni relations for its academy network (Parent Leadership Academy, Family Transformation Academy, Gen Z Career Readiness Academy, Trade & Career Transformation, Corporate Services, and future business units).

**Core Philosophy.** *"One Participant – One Lifetime Digital Record."* Every individual who ever engages TerraNext — as a lead, student, parent, trainee, or alumnus — holds exactly one permanent Participant ID for life, regardless of how many programmes they enrol in over time.

**Business Goals**
- Replace fragmented, manual, paper/spreadsheet/WhatsApp-based operations with one authoritative digital system.
- Support the full participant lifecycle: enquiry → counselling → admission → learning → certification → career guidance → placement → alumni → future re-enrolment.
- Give the Founder and Operations leadership real-time, role-based visibility into enquiries, admissions, attendance, fees, and placement.
- Provide a credible, professional public identity that strengthens corporate and institutional partnerships.

**Product Scope Statement.** The platform is explicitly a **Website + CRM system**, not a full ERP. It excludes payroll, general-ledger accounting, native mobile apps, and self-service portals (student/parent/employer) in the current phase — these are Future Roadmap items (see Phase 17).

**Success Metrics** (drawn from BRD Objectives, Section 13, and SOP KPIs, Ch.15.14 / 18.10):
- 100% of active participants represented in the CRM; single record maintained enquiry-to-alumni.
- Reduced enquiry-to-admission turnaround time (lead response time, conversion rate tracked as KPIs).
- Real-time dashboards for enquiries, admissions, attendance, and placement available to Founder/Operations.
- Attendance-tracking accuracy, participant retention, placement rate, and alumni engagement tracked as ongoing KPIs.

---

<a name="phase-02"></a>
## Phase 02 — Business Analysis

### Earlier State (As-Is)
Per BRD Section 9: acquisition is manual and person-dependent. Enquiries are recorded inconsistently (notebook, personal spreadsheet, or not at all until counselling). Counselling outcomes are verbal, with no systematic link to the eventual admission. Attendance/assessment is kept per-batch, per-trainer, on paper or standalone sheets. Certificates are manually prepared. Placement relies on individual staff-employer relationships with inconsistent outcome recording. No structured alumni relationship exists post-completion.

### Existing Challenges → Business Impact (BRD Section 10)
| Challenge | Impact |
|---|---|
| Fragmented records (notebooks/spreadsheets/messaging apps) | Duplicate records, lost enquiries, inconsistent reporting |
| Manual admissions dependent on staff follow-up | Lost leads, slow conversion |
| No unified participant lifecycle record | Cannot reliably answer retention/completion questions |
| No real-time leadership visibility | Delayed, reactive decisions |
| Ad-hoc communication | Weaker participant experience/brand |
| Manual certificate generation | Risk of error, delay, inconsistency |
| No alumni engagement mechanism | Lost referrals, testimonials, repeat engagement |
| Weak digital presence | Reduced competitiveness for corporate partnerships |

### Business Opportunities (BRD Section 11)
Scalable enrolment without proportional staffing growth; data-driven curriculum refinement; stronger corporate partnerships via credible placement data; alumni monetisation (referrals, upsell, community); reduced per-participant admin cost; consistent brand via CMS.

### Gap Analysis (synthesized)
| Area | Current | Target | Gap |
|---|---|---|---|
| Lead capture | Manual/inconsistent | Automatic from website + all channels (ad, referral, college, walk-in) | Automated intake pipeline (FR-01) |
| Participant record | Per-batch, siloed | Single lifetime record (BR-01) | Unified data model |
| Placement tracking | Staff relationship-based | Structured pipeline with eligibility, readiness score, status stages | Placement Support Module |
| Reporting | Ad-hoc/manual | Role-based real-time dashboards | Reports & Dashboard Module |
| Trade/career track | Not systematized | Dedicated interest module + selective eligibility workflow | Trade & Career Interest Module |

### Stakeholders (BRD Section 17)
Founder, CTO, Operations Manager, Transformation Consultant, Programme Coordinators, Trainers, Finance Officer, Career & Placement Officers, System Administrator, and prospective/enrolled participants.

### Participant Personas (derived from Academy proposal, Section 7)
1. **Student-first participant** — reached via college outreach, free counselling, enrols in Gen Z programme; may trigger parent conversion later.
2. **Parent-first participant** — attends daytime parent session, converts to Family Programme or drives child's Gen Z enrolment.
3. **Career/trade-first participant** — job-seeker or fresh graduate seeking grooming, trade orientation, or global exposure via the Trade & Career pathway.
4. **Referral participant** — sourced via existing participants, families, campus leaders, or social media.

### Business Rules (BRD Section 25 + Academy Section 6)
- **BR-01:** One Participant ID for life, regardless of programme count.
- **BR-02:** No lead-to-participant conversion without a recorded counselling outcome and programme recommendation.
- **BR-03:** No certificate issuance unless attendance/assessment thresholds are met.
- **BR-04:** No batch assignment beyond defined capacity.
- **BR-05:** Alumni status is system-assigned automatically on certificate issuance (Admin override only, logged).
- **BR-06:** All Participant Profile changes are attributable to an authenticated user via Audit Log.
- **BR-07:** Every website registration must create/update a CRM Lead — none discarded.
- **BR-08 (Placement):** TerraNext/Globex Union does **not** charge placement fees to the student; the student/family bears only actual personal travel/visa/migration costs; any lawful third-party fees (employer, embassy, government) are not TerraNext fees and must be handled transparently.
- **BR-09 (Placement eligibility):** Placement-support track is selective — based on discipline, communication, readiness, profile quality, documentation readiness, and fit — not automatic on enrolment.

### Assumptions & Constraints (BRD Sections 26/28)
Single CTO-office point of contact for clarifications; content supplied by TerraNext within a content-freeze window; no legacy data migration unless separately scoped; academy/programme catalogue reasonably stable during build; single primary payment gateway; platform explicitly excludes ERP-level finance/payroll/inventory functionality.

---

<a name="phase-03"></a>
## Phase 03 — Enterprise Architecture

### System Layers (BRD Section 20)
The platform is composed of three interacting layers:
1. **Website Layer** (public-facing, CMS + SEO) — marketing, registration forms, content publishing.
2. **CRM Operational Layer** — lead management through alumni management.
3. **Shared Participant Data Layer** — the single source of truth both layers read/write against, implementing "One Participant – One Lifetime Digital Record."

### High-Level Solution Architecture
```
        ┌─────────────────────────┐
        │      Public Website      │  (CMS-driven, SEO, Register Now form)
        └───────────┬─────────────┘
                     │  (Lead auto-creation, FR-09.2)
        ┌───────────▼─────────────┐
        │        CRM Platform      │
        │  Lead → Counselling →    │
        │  Admissions → Batch →    │
        │  Attendance/Assessment → │
        │  Certificates → Career → │
        │  Placement → Alumni      │
        └───────────┬─────────────┘
                     │
        ┌───────────▼─────────────┐
        │  Shared Participant Data │
        │  Layer (single lifetime  │
        │  record per individual)  │
        └──────────────────────────┘
```

### Database Architecture Note
The BRD is written technology-agnostic; the internal instruction set (Phase 06/Doc 1) specifies **Firestore** as the intended database technology (collections, subcollections, composite indexes). This should be confirmed with the CTO before Phase 06 deep-dive documentation is finalized, since the BRD itself does not commit to a specific database platform.

### Non-Functional / Infrastructure Requirements (BRD Section 22)
| Category | Requirement |
|---|---|
| Performance | Website pages ≤2.5s load (standard broadband); CRM screens ≤2s response |
| Availability | 99.5% uptime target, excluding announced maintenance |
| Scalability | Support 10x current participant volume without redesign |
| Security | RBAC, HTTPS/TLS in transit, encrypted storage of sensitive data |
| Data Privacy | Consent capture at registration; compliance with applicable data protection principles |
| Auditability | All create/update/delete on participant & lead records logged (user, timestamp, change detail) |
| Usability | CRM usable by non-technical staff after ≤half-day training |
| Responsiveness | Fully responsive desktop/tablet/mobile |
| Backup/Recovery | Daily automated backups; RPO/RTO to be agreed at technical design |
| Browser Support | Current + immediately prior major version of Chrome, Edge, Safari, Firefox |

### Deployment/Environment Architecture
**Not yet defined in source material.** BRD scope (Section 29) calls for a Solution Architecture Document translating the BRD into system architecture, data model, and integration design as a distinct deliverable — this is a placeholder pending that document, not to be improvised here.

---

<a name="phase-04"></a>
## Phase 04 — UX Documentation

### UX Strategy Drivers
- **Register Now** is the single most important conversion point on the website — its fields must map 1:1 onto the CRM Lead data structure (FR-09.2) so no re-keying occurs.
- CMS must be operable by non-technical staff (Academies, Programs, Events, Gallery, Blog, Success Stories) with a draft/publish workflow and preview before go-live.
- Dashboards must be **role-based** — Founder sees full analytics; Operations Manager sees daily operations; Trainer sees only assigned batches; Finance Officer sees fee/payment fields only (see Phase 07 Permission Matrix).

### Website Page Inventory (BRD Section 23 + Academy Section 22)
Home · About/Vision-Mission/Founder · Academies (listing + detail) · Programs (listing + detail with syllabus/duration/eligibility) · Events · Gallery · Blog · Success Stories (linked to Alumni, consent-gated) · Career (TerraNext's own recruitment) · Contact · Register Now · Parent Daytime Session page · Trade & Career Transformation page (including placement-support explanation) · Weekend Workshops/Events page.

### Website Forms Required (Academy Section 23)
General enquiry · Gen Z registration/counselling · Family Programme enquiry · Parent session booking · Trade & Career pathway enquiry · Workshop registration · College campus-leader/partner interest form.

### Wireframes (Low/Med/High Fidelity, Desktop/Tablet/Mobile)
**Not yet defined in source material.** No wireframes exist in the uploaded documents. This is a genuine net-new deliverable for the UX phase, to be produced against the page inventory and role-based dashboard requirements above.

---

<a name="phase-05"></a>
## Phase 05 — Design System

**Not yet defined in source material.** The uploaded documents contain no brand guidelines, colour system, typography, spacing, or component specification — only a reference to a *"TerraNext Global Ventures – Brand Guidelines"* document being a **dependency**, not yet delivered (BRD Appendix B, Dependencies Section 27: *"Branding assets (logo, color palette, typography) finalization — TerraNext/Founder's Office — delay UI design sign-off if late"*). A Design System document cannot be honestly written until that brand asset package is received. Recommend this as the first blocking dependency to chase before Phase 05 work begins.

---

<a name="phase-06"></a>
## Phase 06 — Database Design (High-Level)

### Core Entities (derived from BRD glossary, Section 31 + CRM data fields, SOP 15.8)
| Entity | Key Attributes |
|---|---|
| **Lead** | Source (campaign/referral/organic/college/walk-in), contact details, programme of interest, assigned coordinator, stage (new/contacted/counselling booked/attended/hot/admitted/lost/follow-up) |
| **Participant** | Participant ID (permanent, one-per-lifetime), personal info, DOB, contact, emergency contact, consolidated lifecycle timeline |
| **Academy** | Organizational unit offering one or more Programmes (Parent Leadership, Family Transformation, Gen Z Career Readiness, Trade & Career, Corporate Services) |
| **Programme** | Name, duration (e.g. Gen Z = 48 days; Family = 1 month/20 sessions), eligibility, curriculum metadata |
| **Batch** | Code, start/end date, capacity, trainer, session timing, linked programme |
| **Attendance** | Per-session, per-batch, per-participant record; percentage roll-up |
| **Assessment** | Assessment event, score, pass/fail threshold |
| **Certificate** | Unique verifiable certificate number, issue date, linked to completion criteria |
| **Career/Placement Record** | Guidance session log, readiness score, eligibility tag, preferred job category/country, passport status, willingness to relocate, employer pipeline, placement status (not eligible → under review → shortlisted → interview → offer → placed → dropped) |
| **Alumni Record** | Membership date, additional programmes, community participation, referral activity |
| **Fee/Finance Record** | Fee plan, instalment tracking, pending fee alerts, receipt history, discount/scholarship approval |
| **Communication Log** | Channel (email/SMS/WhatsApp), linked to Lead or Participant record, timestamped |
| **Audit Log** | User, timestamp, change detail, entity affected |

### Relationship Notes
- One **Participant** ↔ many **Programme enrolments** (re-enrolment must not create a duplicate Participant record — BR-01/FR-03.3).
- One **Academy** ↔ many **Programmes** ↔ many **Batches**.
- One **Batch** ↔ many **Participants** (capacity-bounded, BR-04).
- One **Lead** converts to exactly one **Participant** (never the reverse) — duplicate-prevention on matching phone/email (FR-01.4).

### Firestore-Specific Design (collections, subcollections, composite indexes, naming conventions, soft-delete/versioning/audit strategy)
**Not yet defined in source material.** The BRD does not commit to Firestore; this was only asserted in the internal instruction prompt. **Recommend confirming the actual database technology with the CTO (Mr. Logeaswaran S) before producing a Firestore-specific schema**, since building detailed NoSQL collection/index design against the wrong platform assumption would need to be redone.

---

<a name="phase-07"></a>
## Phase 07 — Security Documentation

### Role-Based Access Control — Permission Summary
(Consolidated from BRD Section 18 and SOP Chapter 15.5)

| Role | Access |
|---|---|
| Founder & Proprietor | Full read access, dashboards, complete financial/academic/placement reports, CRM administration |
| Operations Manager | Full CRM access; daily operations, admissions, programme monitoring, staff coordination, admin reporting |
| Transformation Consultant | Enquiries, counselling, participant follow-up, admission recommendations; reporting/config review |
| Programme Coordinator | Batch management, attendance, assessments, timetables, certification status |
| Trainer | Assigned batches only — attendance, assessments, session reports, participant progress |
| Finance Officer | Fee management, payment history, receipts, financial reports (finance-related fields only) |
| Career & Placement Officer | Career guidance, resume status, interview records, employer database, placement tracking |
| System Administrator | Full system access — users, roles, audit logs, configuration |
| *(Future)* Student / Parent / Employer | Self-service portal access — out of current scope (see Phase 17) |

### Information Classification (SOP Ch.17.6)
- **Public** — brochures, website content, announcements.
- **Internal** — SOPs, staff schedules, internal reports.
- **Confidential** — participant records, financial records, HR records, assessment results, placement records.
- **Highly Confidential** — passwords, banking details, legal documents, strategic plans, management reports.

### Security Controls Required
- Role-based access control enforced at both CRM and data layer.
- Encrypted data transmission (HTTPS/TLS) and encrypted storage of sensitive participant data (BRD NFR).
- Multi-factor authentication where available; password protection; regular backups; audit logs (SOP Ch.17.10).
- Immutable Audit Log on all create/update/delete actions to Participant/Lead records — user, timestamp, change detail (FR-10.4, BR-06).
- Data Security Incident Management workflow: Identify → Contain → Report to Operations Manager/Founder → Investigate → Corrective Action → Document lessons learned (SOP Ch.17.14).
- Consent capture at registration for personal data collection.

### Required Security Registers (SOP Ch.17.16)
Access Authorisation Register · Confidential Document Register · Data Security Incident Register · Record Retention Register · Document Disposal Register · System Access Log.

### Firestore Security Rules / Storage Rules / Rate Limiting specifics
**Not yet defined in source material** — pending confirmation of the actual backend technology stack (see Phase 06 note).

---

<a name="phase-08"></a>
## Phase 08 — Module Documentation (Overview)

The BRD (Section 24) and SOP Chapter 15.7 define an overlapping, consistent module set. Consolidated module inventory:

| Module | Purpose (one line) | Primary Actor |
|---|---|---|
| Dashboard | Role-based summary of leads, admissions, attendance, assessments, placements | All roles (scoped) |
| Lead Management | Capture and track enquiries from all channels through to admission or loss | Operations Manager / System (auto) |
| Counselling | Log session notes, needs assessment, programme recommendation | Transformation Consultant |
| Admissions | Convert qualified lead → Participant with unique Participant ID | Operations Manager |
| Participant Profile | Single lifetime record consolidating all lifecycle stages | All roles (scoped) |
| Programme & Batch Management | Define Academies/Programmes; schedule Batches with trainer/capacity | Programme Coordinator |
| Attendance | Session-level capture and percentage calculation | Trainer |
| Assessments | Configurable assessment events, score entry, pass/fail thresholds | Trainer |
| Certificates | Rule-based auto-generation with unique verifiable numbering | System (auto) / Programme Coordinator |
| Trade & Career Interest | Capture placement/trade interest, job category, passport status, relocation willingness | Career & Placement Officer |
| Career Guidance & Placement | Log guidance sessions, track employer pipeline and placement outcomes | Career & Placement Officer |
| Alumni | Auto-transition on certification; structured alumni communication | Operations Manager / System (auto) |
| Fees & Collections | Fee plans, instalments, pending-fee alerts, receipts, discounts | Finance Officer |
| Communication | Logged email/SMS/WhatsApp per Lead/Participant, automated reminders | All roles (scoped) |
| Reports & Dashboard | Configurable reports across the full lifecycle | Founder / Operations Manager |
| Users, Roles & Permissions | RBAC configuration | System Administrator |
| Audit Logs | Immutable change log | System Administrator |
| Settings | Central config for academies, programmes, roles, templates | System Administrator |
| Website & CMS | Content publishing for all public page types | Marketing / Transformation Consultant |
| College/Campus Leader Management | College master records, campus-leader-tagged leads, college-wise performance | Operations Manager |

> Each of these 20 modules is a candidate for its own deep-dive Phase 08 document (Purpose, Business Rules, Features, Workflow, Permissions, Database, Forms, Tables, Reports, Notifications, Validation, Dependencies, Future Scope) — flag which modules to prioritize first when we move to per-module documentation.

---

<a name="phase-09"></a>
## Phase 09 — API Documentation

**Not yet defined in source material.** No API contracts, endpoint lists, authentication schemes, payload schemas, or error-response formats exist in any uploaded document — the BRD is a business requirements document, not a technical API spec. This phase depends on the (not-yet-produced) **Solution Architecture Document** referenced in BRD Section 29 as a separate deliverable. Recommend this phase start only after Phase 03/06 technical architecture is confirmed with the CTO.

---

<a name="phase-10"></a>
## Phase 10 — Notification Documentation

### Channels Required (BRD Section 24 + Academy Section 20 + SOP Ch.15.10)
Email · SMS · WhatsApp Business · Push (future) · Automated reminders.

### Trigger Events Identified in Source Material
- Session reminders (weekday Gen Z sessions, parent daytime sessions, weekend intensives).
- Missed-session follow-up.
- Parent orientation invitations.
- Fee reminder communication.
- Certificate notifications.
- Alumni updates / structured alumni communication campaigns (FR-08.2).
- Event notifications.

### Rule
Every communication sent must be logged against the participant's or lead's CRM record (FR-10.3, SOP Ch.15.10) — no notification is sent outside the system without being captured.

### Message Templates, Automation Rule Engine Specifics
**Not yet defined in source material** — template content and precise trigger-condition logic (e.g., "send at T-24h" vs "send at T-1h") are not specified in the uploaded documents and should be gathered from the Operations Manager/Transformation Consultant during the Phase 10 deep-dive.

---

<a name="phase-11"></a>
## Phase 11 — Reporting Documentation

### Report Categories (SOP Chapter 18.7) with Submission Schedule (SOP 18.11)
| Frequency | Examples | Submitted To |
|---|---|---|
| Daily | Office Activity, Enquiry Summary, Admissions, Attendance, Trainer Session, Visitor | Operations Manager |
| Weekly | Batch Progress, Marketing Activity, Counselling, CRM Follow-up, Finance Summary | Founder & Operations Manager |
| Monthly | Academic Performance, Admissions Dashboard, Financial Performance, Placement Progress, Trainer Performance, Participant Feedback | Founder |
| Quarterly | Business Performance Review, Programme Effectiveness, Operational Audit, Strategic Progress | Founder |
| Annual | Annual Academic Report, Annual Financial Report, Institutional Performance, Quality Review, Strategic Planning | Founder |

### Standard Report Structure (SOP 18.8)
Report Title · Report Number · Reporting Period · Department · Prepared By · Reviewed By · Submission Date · Executive Summary · Key Findings · Performance Indicators · Challenges · Recommendations · Action Plan.

### Founder KPI Dashboard (SOP 18.10)
Total Active Participants · Admissions This Month · Programme Completion Rate · Attendance % · Trainer Utilisation · Revenue Performance · Placement Rate · Alumni Growth · Participant Satisfaction · Operational Compliance.

### Additional Business-Specific Reports (Academy Section 21/27)
College-wise and campaign-wise lead/admission reports · Pending fee report · Attendance risk report · Parent conversion report · Placement-support pipeline report · Which campus leader generated which enquiries/admissions.

---

<a name="phase-12"></a>
## Phase 12 — Workflow Documentation

### Master Participant Lifecycle Workflow (BRD Section 19 / SOP 15.6 — reconciled)
```
Marketing Campaign
   ↓
Website Visitor / Enquiry Received (any channel)
   ↓
CRM Lead Created  (BR-07: every registration creates/updates a Lead)
   ↓
Lead Assignment
   ↓
Counselling / Transformation Consultation
   ↓
Programme Recommendation
   ↓
Admission  (BR-02: requires recorded counselling + recommendation)
   ↓
Participant ID Generated  (BR-01: permanent, one per lifetime)
   ↓
Orientation
   ↓
Batch Allocation  (BR-04: capacity-bounded)
   ↓
Attendance Tracking
   ↓
Assignments & Assessments
   ↓
Programme Completion
   ↓
Certificate Issued  (BR-03: attendance/assessment thresholds met)
   ↓
Career Guidance
   ↓
Placement Support  (selective — BR-09)
   ↓
Alumni Membership  (BR-05: auto-assigned on certification)
   ↓
Future Programme Enrolment
```
**Design Principle (BRD Section 19):** every arrow represents a state transition on the *same* participant record — never a handoff to a new record or re-entry of data.

### Alternate Entry Workflows (Academy Sections 25–26)
- **Gen Z Student path:** Lead (website/ad/college/referral) → Counselling → Profiling → Batch recommendation → Parent orientation (if needed) → Admission → 48-day attendance/weekly review → Completion/certificate/90-day plan → Placement-support review (if suitable).
- **Parent-First path:** Parent attends daytime session → Parent profile/family concern recorded → Recommendation (Family Programme or child's Gen Z enrolment) → Child profile created if parent agrees → Admissions/follow-up managed from the same family record.

### Escalation/Reminder/Notification Workflows
**Not yet defined in source material** in step-by-step form — trigger events exist (Phase 10) but the escalation decision tree (e.g., who gets notified after N missed sessions) is not specified and should be captured directly from Operations.

---

<a name="phase-13"></a>
## Phase 13 — Development Standards

**Not yet defined in source material.** Folder structure, coding/naming standards, Git branching strategy, reusable component/hook/service conventions, and code review checklists are not present in any uploaded business document — these are technical-team decisions that belong to engineering, not the business/BRD documents provided. Recommend this phase be authored jointly with the CTO once the technology stack (Phase 03/06 note) is confirmed.

---

<a name="phase-14"></a>
## Phase 14 — DevOps Documentation

**Not yet defined in source material**, with one exception: BRD Non-Functional Requirements (Section 22) specify 99.5% uptime target and daily automated backups with RPO/RTO "to be agreed during technical design" — meaning even the source BRD explicitly defers DevOps specifics to a later technical-design stage. Environment strategy (dev/test/staging/prod), CI/CD, rollback, monitoring, and logging should be authored as part of that technical design activity referenced in BRD Section 29 (Solution Architecture Document deliverable).

---

<a name="phase-15"></a>
## Phase 15 — Quality Assurance

### What Source Material Defines
- **UAT Sign-Off Report** is an explicit contractual deliverable (BRD Section 29): documented User Acceptance Testing results against the Functional Requirements in BRD Section 21.
- Functional Requirements (FR-01 through FR-10) form the natural basis for a functional test plan/traceability matrix.
- NFR table (BRD Section 22) forms the basis for performance, security, and browser-compatibility test plans.

### Not Yet Defined
Detailed test case scripts, regression suite design, accessibility testing checklist, and specific performance/load testing targets beyond the 2–2.5 second thresholds are not present in source material and should be developed against the FR/NFR tables above once technical design is complete.

---

<a name="phase-16"></a>
## Phase 16 — Deployment Guide

### What Source Material Defines
BRD Section 29 lists **Go-Live & Hypercare Support** as a deliverable: "Deployment to production and a defined post-launch hypercare support period." BRD Section 27 (Dependencies) flags domain/hosting provisioning, SSL certificate and email service configuration as pre-go-live blockers owned by TerraNext/CTO and the System Administrator respectively.

### Not Yet Defined
A formal deployment checklist, production readiness checklist, health-check procedure, and incident-response runbook are not present in the source documents and should be authored alongside the DevOps documentation (Phase 14) once environment architecture is confirmed.

---

<a name="phase-17"></a>
## Phase 17 — Future Roadmap

Consolidated from BRD Section 30 and the Academy proposal's closing recommendation (Volume 2, Ch.15 commentary):

| Phase | Roadmap Item |
|---|---|
| Phase 2 | Student Self-Service Portal (view attendance, assessments, certificates) |
| Phase 2 | Parent / Guardian Visibility Portal |
| Phase 2 | Employer Placement Partner Portal (candidate profiles with consent) |
| Phase 3 | Native mobile applications (iOS/Android) |
| Phase 3 | Advanced analytics and predictive reporting (at-risk participant identification) |
| Phase 3 | Multi-language website localization |
| Phase 4 | Integration with external finance/ERP systems, if TerraNext's operations require it |
| *(Directional, not yet scoped)* | Full LMS; AI Assistant; workflow automation; multi-branch/multi-academy/multi-country expansion; separate dashboards for management, staff, trainers, participants, parents, and employers — positioning TerraNext as a "technology-enabled education and transformation institution" supporting expansion across India and internationally |

> The BRD explicitly notes the current platform's data model **should not preclude** these future roles/features, even though they are out of scope for this build phase.

---

<a name="appendix"></a>
## Appendix — Glossary & References

### A. Glossary of Terms (BRD Appendix A)
| Term | Definition |
|---|---|
| Lead | A prospective participant recorded in the CRM prior to admission |
| Participant | An individual admitted to a TerraNext programme |
| Batch | A scheduled group instance of a Programme, with defined start/end dates and a trainer |
| Alumni | A Participant who has completed a Programme and received a Certificate |
| Academy | An organizational unit within TerraNext offering one or more Programmes |
| Participant ID | A unique, permanent identifier assigned to a Participant upon admission |

### B. Governing Business Rules Reference
See Phase 02 (Business Rules) and Phase 06/07 for how BR-01 through BR-09 constrain the data model and permission structure.

### C. Source Document Traceability
| This Document's Section | Primary Source |
|---|---|
| Phase 01, 02 | TerraNext BRD v1.0, Sections 7–14, 17–26 |
| Phase 03 | TerraNext BRD v1.0, Sections 20, 22 |
| Phase 04, 05 | TerraNext BRD v1.0, Sections 23, 27 (Dependencies) |
| Phase 06, 07, 08, 09 | TerraNext BRD v1.0 Sections 15/16/21/24 + SOP Ch.15/17 + Academy proposal Sections 11–21 |
| Phase 10, 11, 12 | SOP Ch.15/18 + BRD Section 19/21 + Academy proposal Sections 20–27 |
| Phase 13–16 | TerraNext BRD Sections 22, 27, 29 (explicitly deferred to technical design) |
| Phase 17 | TerraNext BRD Section 30 + Academy/SOP closing recommendations |

### D. Open Items Requiring Stakeholder Input Before Next-Level Documentation
1. **Confirm backend/database technology** (Firestore assumed in internal brief but not committed in the BRD) — blocks Phase 06/07/09 technical depth.
2. **Obtain TerraNext Brand Guidelines** — currently an unresolved dependency (BRD Section 27) — blocks Phase 05 (Design System) and Phase 04 (high-fidelity wireframes).
3. **Confirm payment gateway provider** — currently unresolved (BRD Assumptions, Section 26) — affects Fees & Collections Module and Phase 09 API scope.
4. **Escalation-rule detail** for missed sessions / at-risk attendance — not specified in source material — needed for Phase 10/12 depth.
5. **Solution Architecture Document** — listed as a BRD deliverable (Section 29) but not yet produced — is the prerequisite for Phases 03, 06, 09, 13, 14, 16 to move from "high-level" to full technical depth.

---

*End of Consolidated Master Documentation — Draft v0.1. This document intentionally stays at a high level per your request. Tell me which Phase(s) or module(s) you want expanded into a full standalone deep-dive document next, and I'll build those out in detail.*