# 12 — Future Architecture

**TerraNext Business OS · Architecture Blueprint**
Mandate (BRD Section 30 / Master Doc Phase 17): today's build must not preclude the roadmap. This document names, for each future capability, the **seam we are building now** and the **work deferred** — so "future-proof" is a checklist, not a slogan.

---

## 1. Portals (Student · Parent · Trainer · Employer)

**Seam built now**
- Shared Firestore as the only data layer (Doc 01) — portals are new *readers*, not new databases.
- Claims schema `{ role, branchId }` with reserved portal roles (`portal_student`, `portal_parent`, `portal_employer`) (Doc 04 §6).
- Participant data already shaped for self-scoped reads: everything a student sees lives under `participants/{id}/**`; a parent link exists (`family` block); employer consent flag exists (`alumniRecords.consentForSuccessStory`, `careerProfiles` consent to be added at portal time).
- Rules organized as per-collection role predicates — adding `isSelf(participantId)` predicates extends, never restructures.

**Deferred** — separate Next.js apps (`portal/`, `partners/`) on the same Firebase project; portal identity linking (Auth user ↔ participantId via a `portalAccounts/{uid}` mapping doc); consent-scoped employer projections (candidate profile views, never raw docs).
> Trainer portal note: trainers are staff — their "portal" is the existing CRM scoped by RBAC; a lightweight mobile-web attendance surface reuses the same routes (Doc 07 mobile-first attendance).

## 2. Mobile App

**Seam built now** — domain layer is framework-free Zod + pure TS (Doc 01 A-3), reusable from React Native/Expo; all privileged operations already flow through callable Functions (a mobile client calls the same functions); auth is Firebase Auth (native SDKs exist).
**Deferred** — the app itself; push notifications (FCM token registry on `users`).

## 3. LMS

**Seam built now** — `programmes` carry curriculum metadata; `batches/sessions` model class delivery; `assessments` are already first-class. An LMS adds content (`programmes/{id}/modules/{id}/lessons`) and submissions — sibling subcollections, no re-modelling of existing entities.
**Deferred** — content authoring, media pipeline (Storage streaming), progress tracking, grading workflows.

## 4. AI Assistant

**Seam built now** — clean domain vocabulary + Zod schemas double as tool/function-calling definitions; `auditLogs` and `timeline` give grounded, per-record context; RBAC means an assistant runs **as the signed-in user's permissions** (server-side, permission-checked retrieval — never a bypass path).
**Deferred** — retrieval endpoints, model integration (Claude API), at-risk-participant prediction (Phase 3 roadmap) fed by `stats` aggregates.

## 5. API Integrations (payment gateway, WhatsApp/SMS/email, external systems)

**Seam built now** — `communications` doc model is provider-agnostic (`channel`, `templateKey`, `status`); `feeAccounts/payments` separates the ledger from collection method (gateway webhook will create payment docs through the same audited path as manual receipts); all external I/O lives in Functions behind narrow interfaces (`functions/src/lib/providers/`).
**Deferred** — provider adapters (gateway TBD — open blocker; WhatsApp Business API vendor), webhook endpoints with signature verification, retry/queue semantics (Cloud Tasks).

## 6. Multi-Branch · Multi-Academy · Multi-Country

**Seam built now — the most important one:**
- `branchId` on **every document** from day one (Doc 03 §0), `"HQ"` default; composite indexes designed with `branchId` as an early field (Doc 11 §2) so scoping queries need no index migration.
- Multi-academy is **already live structure** (`academies` → `programmes` → `batches`) — not future work.
- Claims carry `branchId`; reserved `branch_manager` role (Doc 04 §6).
- Counters are per-scope capable (`counters/{branchId_participantId}` naming ready) — Participant IDs can become branch-prefixed without collision.

**Deferred** — branch admin UI, cross-branch reporting roll-ups (`stats` per branch + org), country-level concerns: data residency (may force per-region Firebase projects — see risk in Doc 13), currency (`amountPaise` generalizes to `amountMinor` + `currency` at that point), localization (next-intl; all UI strings already flow through components, but extraction to message catalogs is deferred work), statutory formats per country.

## 7. What We Deliberately Do NOT Build Now

To keep future-proofing honest, these were considered and **rejected** for phase 1:

| Rejected now | Why |
|---|---|
| Full multi-tenant abstraction layer (tenant resolver, per-tenant config trees) | One branch exists; `branchId` fields + scoped claims capture 90% of the future need at ~2% of the cost |
| Runtime-editable permission matrix | Security risk without a policy-test harness (Doc 04 §4); revisit with multi-branch |
| Event-sourcing / CQRS | auditLogs + timeline give the traceability the BRD needs; full ES is operational overkill for this team size |
| Generic plugin/module framework | 20 modules are known and enumerated; YAGNI |
| Per-country Firebase projects | Premature until a second country is real; flagged as the one future item that could force real restructuring (Doc 13 R-8) |

## 8. Compatibility Checklist (run against every future feature plan)

1. Does it read/write the shared Firestore, or does it fork data? (fork = redesign, reject)
2. Does it authenticate via Firebase Auth claims within the reserved namespace?
3. Do its writes flow through audited paths (BR-06 applies to portals too)?
4. Does it respect `branchId` scoping in queries and rules?
5. Does it reuse domain schemas from the framework-free layer rather than redefining shapes?
