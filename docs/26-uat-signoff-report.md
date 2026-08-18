# 26 — UAT Test Case Checklist & Sign-Off Report

**TerraNext Business OS · Go-Live (Doc 22 M8)**
Status: **Test cases drafted 2026-07-26; execution pending.** This document is the traceability matrix Doc 22 M8's acceptance criterion requires ("every FR row traced to a passing UAT case") and the sign-off record Doc 24 §7 references. It does **not** assert any case has passed — every row below is unexecuted until a named tester runs it against a real (staging or production-mirroring) environment and records a result. Marking a case "Pass" without having actually run it would defeat the purpose of UAT; this report is written to be filled in, not to pre-fill itself.

> **On FR numbering:** the codebase's inline comments cite specific clauses of an external BRD (e.g. `FR-01.4`, `FR-09.2`, `FR-10.3` — see Doc 03/14/15/19 for occurrences), but that BRD document itself is not part of this repository, so this report cannot reproduce its exact FR-01…FR-10 structure. Instead, every test case below is traced to what **is** authoritative in-repo: the BR-01…BR-09 business rules (Doc 15) and each milestone's explicit acceptance criterion (Doc 22). Whoever holds the source BRD should cross-map these case IDs to the formal FR clauses before final sign-off — that mapping is a 1:1 clerical pass once both documents are side by side, not a re-test.

**Owners:** Tester = person executing the case · Reviewer = person confirming the recorded result · Environment = where it was run (must be named, e.g. "staging, commit `abc1234`").

---

## 1. Business Rules (Doc 15 BR-01…BR-09)

| Case | Rule | Scenario | Steps | Expected result | Status | Tester | Date | Environment |
|---|---|---|---|---|---|---|---|---|
| UAT-BR01-1 | BR-01 | Duplicate phone at conversion | Create two leads with the same phone; convert the first; attempt to convert the second | Second conversion surfaces the first as a duplicate match; "link to existing participant" path offered, no second Participant ID minted | Pending | | | |
| UAT-BR01-2 | BR-01 | Participant ID immutability | As ops_manager, attempt to edit a participant's ID via any UI path or direct API call | No path exists to change it; a raw Firestore write attempt is rules-denied (`unchanged` constraint) | Pending | | | |
| UAT-BR02-1 | BR-02 | Convert without counselling | Attempt to convert a lead with no counselling session recorded | Convert action blocked in UI with explanation; a forced server-side attempt (bypassing UI) returns `precondition` with `rule: 'BR-02'` | Pending | | | |
| UAT-BR02-2 | BR-02 | Convert with `not_suitable` outcome only | Record a session with outcome `not_suitable`, attempt conversion | Still blocked — only `recommended` with a non-null recommendation satisfies BR-02 | Pending | | | |
| UAT-BR03-1 | BR-03 | Certificate below threshold | Participant below `minAttendancePct` attempts issuance | Issuance refused; evidence snapshot shown in the eligibility queue names the shortfall | Pending | | | |
| UAT-BR03-2 | BR-03 | Stale roll-up, accurate raw data (C-2) | Force `enrolments.attendancePct` out of sync with raw attendance docs (simulate trigger lag), then issue | Issuance transaction recomputes from raw docs and decides correctly regardless of the stale roll-up | Pending | | | |
| UAT-BR04-1 | BR-04 | Batch at capacity | Allocate the last open seat, then attempt one more allocation | Second allocation refused with `conflict`; `enrolledCount` never exceeds `capacity` | Pending | | | |
| UAT-BR04-2 | BR-04 | Concurrent allocation race | Two allocation attempts submitted for the last seat at effectively the same time (two browser tabs / two testers) | Exactly one succeeds; the other receives `conflict`, not a corrupted count | Pending | | | |
| UAT-BR05-1 | BR-05 | Certificate issuance creates alumni | Issue a certificate for a participant with no prior alumni record | `alumniRecords/{participantId}` created automatically, `triggeredByCertificateId` set; no manual step | Pending | | | |
| UAT-BR05-2 | BR-05 | Alumni override requires reason | Attempt a manual alumni status override with an empty reason | Refused; a non-empty reason is accepted and recorded as an `override` audit entry | Pending | | | |
| UAT-BR06-1 | BR-06 | Audit trail on a mutation | Change a lead's stage; open its History tab | Audit entry present with actor, timestamp, before/after diff | Pending | | | |
| UAT-BR06-2 | BR-06 | Audit immutability | As system_admin, attempt to edit or delete an existing `auditLogs` entry | Refused for every role, including system_admin/founder | Pending | | | |
| UAT-BR07-1 | BR-07 | Website submission becomes a lead | Submit the public `/apply` (or growth-partner registration) form | A `leads` (or `growthPartners`) document appears within 5 seconds, correct `source`, consent recorded | Pending | | | |
| UAT-BR07-2 | BR-07 | Duplicate submission | Submit the same phone number twice via the website form | Second submission dedupes to an activity entry on the existing lead, not a new lead | Pending | | | |
| UAT-BR08-1 | BR-08 | Zero placement fee enforced | Attempt to set `feeDisclosure.terranextFeePaise` to a non-zero value via any path, including a direct API/rules attempt | Refused everywhere; UI never offers a non-zero field | Pending | | | |
| UAT-BR09-1 | BR-09 | Placement blocked pre-evaluation | Attempt to create a placement for a participant with `eligibility: not_evaluated` | Refused with `precondition`, `rule: 'BR-09'` | Pending | | | |
| UAT-BR09-2 | BR-09 | Eligibility requires evaluator fields together | Attempt to set `eligibility: eligible` without `evaluatedBy`/`evaluatedAt`/note | Refused; only complete evaluations are accepted | Pending | | | |

## 2. Milestone Acceptance Criteria (Doc 22)

| Case | Milestone | Acceptance criterion (verbatim from Doc 22) | Status | Tester | Date | Environment |
|---|---|---|---|---|---|---|
| UAT-M1-1 | M1 | Admin provisions a user by email link; new user logs in, sees role-scoped nav | Pending | | | |
| UAT-M1-2 | M1 | Role change reflects ≤1h (immediately on disable) | Pending | | | |
| UAT-M1-3 | M1 | Every mutation visible in audit screen; all rules deny-tests green (`npm run test:rules` — automated, see Doc 24 §6a) | Pending | | | |
| UAT-M2-1 | M2 | Website submission appears as lead ≤5s with consent recorded | Pending | | | |
| UAT-M2-2 | M2 | Follow-up digest arrives; every send logged | Pending | | | |
| UAT-M3-1 | M3 | Conversion mints sequential IDs under concurrent attempts | Pending | | | |
| UAT-M3-2 | M3 | Capacity race loses cleanly with `conflict`; audit trail shows full chain | Pending | | | |
| UAT-M4-1 | M4 | Trainer marks a 30-roster session on mobile in under 2 minutes | Pending | | | |
| UAT-M4-2 | M4 | Cross-batch trainer write denied (rules test — automated) | Pending | | | |
| UAT-M5-1 | M5 | Participant below threshold cannot be issued a certificate (server-forced test bypassing UI) | Pending | | | |
| UAT-M5-2 | M5 | Public `verifyCertificate` returns no PII for invalid/revoked/missing alike | Pending | | | |
| UAT-M6-1 | M6 | Placement creation blocked for non-evaluated profile | Pending | | | |
| UAT-M7-1 | M7 | Installment sums always reconcile; balance arithmetic exact under concurrent payments | Pending | | | |
| UAT-M7-2 | M7 | Receipt sequence gapless per FY; discount without approver rank denied | Pending | | | |
| UAT-M8-1 | M8 | Founder dashboard live-accurate vs manual tally on staging seed | Pending | | | |
| UAT-M8-2 | M8 | Every export leaves an `export` audit entry | Pending | | | |
| UAT-GPMS-1 | M-GPMS | Referral rides the existing pipeline with zero forking (leads→counselling→admission→fee, `source: referral`) | Pending | | | |
| UAT-GPMS-2 | M-GPMS | Partner reads only their own `growthPartners`/`wallets`/`rewardLedger`/leads rows | Pending | | | |
| UAT-GPMS-3 | M-GPMS | Reward accrual and wallet credit happen atomically with payment recording | Pending | | | |
| UAT-GPMS-4 | M-GPMS | Payout approval is audited; wallet debited only on `paid` | Pending | | | |

## 3. Execution Instructions

1. Deploy the commit under test to staging (Doc 24 §2).
2. For each case: execute the steps as the stated actor (use a seeded test account per role, not a real production account), record **Pass** or **Fail** — never leave a run silently unrecorded — plus tester, date, and the exact environment/commit.
3. Any **Fail** blocks go-live sign-off until re-tested green after a fix.
4. Automated cases (rules deny-tests, unit tests) are marked in-line above where Doc 24 §6a / `npm run test:rules` already covers them — re-verify the CI run is green for the commit under test rather than re-running by hand.
5. Once every row is Pass, the Owner records final sign-off in Doc 24 §7.

## Sign-off

- [ ] All rows above executed and Pass
- [ ] Owner: _______________________  Date: _______________
