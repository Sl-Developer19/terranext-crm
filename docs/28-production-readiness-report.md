# 28 — Production Readiness Report

**TerraNext Business OS · Go-Live**
Date: 2026-07-26 · Scope: full-system production-readiness pass across the CRM (`D:\terranext_website\crm`) and the public website (`D:\terranext_website\terranext`), initiated after an audit found M1–M7 already shipped and M8 partially complete.

---

## 1. Executive Summary

The CRM was already a mature, well-architected system before this pass — 26 feature modules, full RBAC/audit/rules discipline, 458 passing tests, and a newly-built Growth Partner Management System (GPMS). This pass did not rebuild anything; it reconciled stale documentation, closed the remaining M8 go-live gaps, fixed a set of real correctness/security bugs found by a targeted code review, fixed a live website↔CRM integration break, and re-verified every quality gate — including one that had never actually run in CI before this pass (the Firestore rules emulator suite).

**No critical blockers remain open.** Two moderate items are explicitly flagged as follow-up (below) rather than fixed in this pass, and are safe to defer.

---

## 2. Modules Completed (status as of this pass)

| Milestone | Modules | Status |
|---|---|---|
| M1 | Foundation: auth, RBAC, audit, AppShell, CI | Shipped |
| M2 | Leads, counselling, colleges, catalogue, website intake | Shipped (S10/S11 fast-follows tracked, not blockers) |
| M3 | Admissions, participants, batch capacity | Shipped |
| M4 | Batches, attendance, assessments | Shipped |
| M5 | Certificates, alumni | Shipped (atomicity bug fixed this pass) |
| M6 | Career, placements, employers | Shipped |
| M7 | Fees & collections | Shipped (concurrency bug fixed this pass) |
| M8 | Reports, dashboards, go-live hardening | **Completed this pass** |
| M-GPMS | Growth Partners, rewards, wallets, payouts, partner portal | Shipped 2026-07-26; website integration gap fixed this pass |

## 3. Files Created

- `docs/26-uat-signoff-report.md` — UAT test-case checklist traced to BR-01…BR-09 and every milestone's acceptance criteria (unexecuted — ready for a tester to run)
- `docs/27-security-review-public-endpoints.md` — full inventory + review of every unauthenticated endpoint
- `docs/28-production-readiness-report.md` — this document
- `lighthouserc.json`, `lighthouse-budgets.json` — Lighthouse CI config/budgets (Doc 11 §8)
- `scripts/lighthouse-authenticated.mjs` — authenticated-route performance script for staging runs

## 4. Files Modified — CRM (`crm/`)

**Docs (reconciliation + corrections):** `02, 03, 04, 14, 15, 16, 18, 20, 21, 22, 24` -folder-architecture/database-blueprint/rbac-blueprint/data-dictionary/business-rules-matrix/screen-inventory/firestore-rules-matrix/api-contract/risk-register/implementation-roadmap/deployment-runbook.md

**Infra:** `.github/workflows/ci.yml` (added `rules` + `perf` jobs), `.gitignore`, `package.json`/`package-lock.json` (added `@lhci/cli`, `lighthouse`, `chrome-launcher`, `firebase-tools`; **upgraded `next` 15.1.12 → 15.5.22, fixing a critical CVE**), `firestore.rules` (comment-only BR-08 defense-in-depth note)

**Code fixes** (all typecheck/lint/test/build-verified):
- `src/features/rewards/repository.ts`, `src/features/rewards/schema.ts`, `src/features/rewards/actions/manage-reward-rules.ts` — reward clawback on payment reversal; one-active-rule-per-programme enforcement; transactional payout decision
- `src/features/fees/repository.ts` — fixed a lost-update race in payment recording/reversal; wired in reward clawback
- `src/features/certificates/repository.ts`, `src/features/alumni/repository.ts` — atomic alumni-record creation (BR-05)
- `src/features/colleges/actions/manage-college.ts`, `src/app/(app)/colleges/page.tsx` — closed an RBAC gap (consultants could edit college master data, not just leaders)
- `src/features/batches/repository.ts`, `src/features/batches/actions/allocate-batch.ts`, `src/features/admissions/actions/convert-lead.ts` — batch-status race fixed (BR-04)
- `src/features/placements/repository.ts`, `src/features/placements/actions/manage-placement.ts` — transactional stage-advance
- `src/features/dashboard/repository.ts`, `schema.ts`, `logic.ts`, `logic.test.ts` — scan-cap truncation now surfaced as `partial` metrics instead of silently understating
- `src/app/api/certificates/verify/route.ts`, `src/app/api/errors/report/route.ts`, `src/app/api/auth/forgot-password/route.ts`, `src/app/api/auth/reset-password/route.ts` — added missing rate limits (Doc 27)
- `src/features/growth-partners/*` — added `applicationNotes` field (schema, public-schema, register-public action, queries, detail view) closing the website-intake data-loss gap

## 5. Files Modified — Website (`terranext/`)

- `lib/crm.ts` — added `submitGrowthPartnerRegistration` (correct CRM contract)
- `components/forms/GrowthPartnerForm.tsx` — **rewired from the generic lead-intake pipeline to the actual `/api/registerGrowthPartner` endpoint** — this was the critical integration fix
- `.env.example` — updated to document both public intake endpoints
- `package.json` — upgraded `next` 15.1.12 → 15.5.22 (same critical CVE)

## 6. Firestore Collections

No new collections this pass (GPMS's `growthPartners`, `rewardRules`, `rewardLedger`, `wallets`(+`transactions`), `payoutRequests`, `partnerNotifications` were already shipped 2026-07-26). `growthPartners` gained one field: `applicationNotes: string | null`.

## 7. Firestore Indexes

No new indexes required. Verified `participants.partnerId` has no query depending on a composite index today (only single-doc reads) — flagged as a forward-looking item, not a current gap.

## 8. Security Rules

`firestore.rules`: one comment-only change (BR-08 defense-in-depth guardrail on `placements`). `npm run check:rules-drift` clean; `npm run test:rules` — **28/28 passing**, now wired into CI for the first time (previously only run ad hoc).

## 9. APIs Added/Changed

No new endpoints. `registerGrowthPartner`'s accepted payload gained an optional `applicationNotes` field (additive, non-breaking).

## 10. Website ↔ CRM Integration — Verified

| Flow | Status |
|---|---|
| Website enquiry → CRM Leads | ✅ Working (`createLead`) |
| Growth Partner registration → CRM Growth Partners | ❌ **Was broken** (posted as a lead, not a partner record) → ✅ **Fixed this pass** |
| Approval workflow → Firebase Auth account + partner login | ✅ Verified working (`decideGrowthPartner`) |
| Lead lifecycle (stage, assignment, activities) | ✅ Verified |
| Payment lifecycle (ledger, receipts, reversals) | ✅ Verified, 2 bugs fixed |
| Reward engine (accrual, clawback, payout) | ✅ Verified, 2 bugs fixed |
| Notifications (email + in-app) | ✅ Verified |

## 11. Dashboard & Reports

Founder KPI dashboard and report centre were already shipped; this pass fixed the silent scan-cap truncation issue (§ above) so operators see a `partial` flag instead of a quietly-wrong number once any bounded scan exceeds 1,000 docs.

## 12. Remaining Issues (not blockers — explicitly deferred)

| # | Item | Severity | Why deferred |
|---|---|---|---|
| 1 | No Firestore-rules-emulator test coverage for the GPMS collections specifically (`growthPartners`, `rewardLedger`, `wallets`, `payoutRequests`, `rewardRules`) | Medium | Manual rules review confirms correct row-scoping; writing new emulator tests is a substantial, separate effort better scoped on its own |
| 2 | `reports.ts` has ~10 more SCAN_CAP call sites not yet wired to a `partial`/caveat signal (unlike `dashboard.ts`, which is fully fixed) | Low-Medium | Same silent-truncation risk, smaller blast radius (reports are run on demand, not the landing page) |
| 3 | `firebase-admin`'s transitive dependency chain (`@google-cloud/firestore`/`storage`, `google-gax`, `teeny-request`, `uuid`) carries 8 moderate + 3 high advisories with no fix available except a major-version change npm's own resolver can't safely suggest (it recommends *downgrading* to firebase-admin 10.x) | Medium | Requires a deliberate, tested dependency-upgrade project, not a forced/automated change |
| 4 | Campus leaders have no edit action (create + activate/deactivate only) | Low | UX completeness gap, not a correctness bug |
| 5 | Assessments have no delete/archive path | Low | Same — completeness, not correctness |
| 6 | `registerGrowthPartner`'s `conflict` response is a mild email-enumeration surface | Low | Already rate-limited; documented in Doc 27 §2.1 as an accepted tradeoff |
| 7 | A stray `package-lock.json` exists at `D:\terranext_website\` (parent of both repos), causing an "inferred workspace root" warning from Next.js tooling | Low | Cosmetic; investigate and remove if not intentionally used |

## 13. Deployment Checklist

See `docs/24-deployment-runbook.md` §7 for the full, authoritative checklist (updated this pass with Lighthouse gates and GPMS-specific verification steps). Summary of what changed:
- [ ] `npm run perf:lighthouse` passes against `/login`, `/partner/login` (new)
- [ ] `npm run perf:lighthouse:auth` run against staging with a seeded perf-test account (new, manual pre-release step)
- [x] `npm run test:rules` passes — 28/28 (now CI-verified, was previously ad hoc)
- [ ] `PUBLIC_INTAKE_ORIGINS` covers the growth-partner registration form's origin (shared with `createLead`)
- [ ] Full Growth Partner end-to-end flow smoke-tested against staging (registration → approval → login → referral → payment → reward → payout)

## 14. Go-Live Checklist

See `docs/24-deployment-runbook.md` §7 (Pre-deployment / Deployment / Post-deployment verification / Operational readiness / Sign-off). Two new sign-off artifacts now exist and need executing, not just reading:
- [ ] `docs/26-uat-signoff-report.md` — every case executed and Pass
- [ ] `docs/27-security-review-public-endpoints.md` — items 4–5 (App Check enforcement, `PUBLIC_INTAKE_ORIGINS` match) confirmed in the production console

## 15. Recommended Follow-Up Work (post-launch, not blocking)

1. Build the S10/S11 lead-screen fast-follows already itemized in Doc 16 (kanban toggle, filters, export, consent display).
2. Write the Firestore rules-emulator test suite for the GPMS collections (Remaining Issue #1).
3. Extend the scan-cap `partial`/caveat pattern from `dashboard.ts` to `reports.ts`'s remaining call sites (Remaining Issue #2).
4. Plan a deliberate `firebase-admin` major-version upgrade cycle to close the transitive vulnerability chain (Remaining Issue #3) — budget real regression-testing time, since it's a semver-major change touching every server action in the codebase.
5. Add campus-leader edit and assessment delete/archive actions if operators ask for them.
6. Automate `perf:lighthouse:auth` once a staging environment + secret-rotation process exists (currently a manual pre-release step, Doc 24 §8).
