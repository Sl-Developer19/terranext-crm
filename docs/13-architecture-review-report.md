# 13 — Architecture Review Report

**TerraNext Business OS · Pre-Implementation Review of Blueprints 01–12**
Reviewer stance: adversarial self-review — what would a hostile tech lead flag before approving this architecture?

---

## 1. Verdict

The architecture is **approvable with conditions**. It is internally consistent, traceable to the BRD/SOPs, and honest about deferrals. The conditions (§6, C-1…C-4) address the four findings below that would otherwise bite within the first two milestones. Nothing found requires restructuring the blueprints.

## 2. Weaknesses (present-tense, in the design as written)

**W-1 · The permission map is triple-represented.** `ROLE_PERMISSIONS` in code, mirrored to `settings/roles`, and re-expressed in Firestore rules. Doc 10 mitigates with codegen (rules generated from the TS map), but the codegen script itself is now security-critical infrastructure that doesn't exist yet. Until it does, code and rules **will** drift. → C-1.

**W-2 · Trigger-maintained aggregates are eventually consistent.** `attendancePct`, `stats` docs, and `enrolledCount`-adjacent roll-ups depend on Cloud Function triggers, which can lag or (rarely) double-fire. A coordinator could see a stale attendance % during certificate eligibility checks — a BR-03 correctness issue, not just cosmetics. Mitigation: certificate issuance (the one place it legally matters) must **recompute from raw attendance docs inside the issuing transaction**, treating the roll-up as display-only. This rule must be explicit in the certificates module plan. → C-2.

**W-3 · Client-batched audit writes have a validation ceiling.** `withAudit` commits business write + audit doc in one batch, and rules can require the audit doc's presence only indirectly (rules cannot inspect "the rest of the batch"). A malicious-but-authenticated staff client could craft a write without its audit companion for any collection where client writes are permitted. Consequence: the set of client-writable collections must stay minimal (leads/activities, attendance, notes), and everything else goes server-action/Function — which Doc 10 §3 already states, but the review point is: **treat every new client-writable collection as a security decision, listed in the PR checklist.** → folded into C-1 checklist.

**W-4 · Search is naïve by design.** `searchTokens` prefix matching won't do fuzzy matching, misspelled names, or cross-field search. Acceptable at hundreds of participants; frustrating at thousands (10× NFR). The upgrade path (Algolia/Typesense) is named but not budgeted. → R-6.

**W-5 · Single shared Firebase project couples website and CRM blast radius.** A misconfigured rule or quota exhaustion (e.g. lead-spam hitting Firestore writes) affects both surfaces. Accepted trade-off for the shared data layer, but it obliges: App Check on both apps, budget alerts, and the createLead rate limiting from Doc 10 §5 to be in the **first** deployment, not a fast-follow.

**W-6 · No staging environment in the plan.** Trunk-based + preview channels covers the app, but Firestore rules/indexes/Functions changes deploy to the one production project. A `terranextglobal-staging` project (free tier) for emulator-insufficient verification (index builds, trigger behavior at scale) is cheap insurance. → C-3.

## 3. Future Risks

| # | Risk | Likelihood | Impact | Position |
|---|---|---|---|---|
| R-1 | Brand guidelines arrive late and diverge hard from provisional tokens (new font metrics, dense palette) | Medium | Low | Token isolation (Doc 07) contains it; only real exposure is chart palette semantics |
| R-2 | Payment gateway choice imposes flow constraints (e.g. mandates hosted checkout) | Medium | Medium | Ledger/method separation (Doc 12 §5) contains it; do not build any gateway-shaped UI until chosen |
| R-3 | Escalation rules (missed sessions) arrive with cross-module implications (auto-notifications + task assignment) | High | Medium | `communications` + `timeline` models absorb it; needs its own mini-blueprint when Ops specifies |
| R-4 | Custom-claims 1000-byte limit vs role model growth (per-branch role arrays) | Low | Medium | Current payload ~40 bytes; branch-scoped multi-role would need a claims redesign — acceptable deferral |
| R-5 | Firestore vendor lock-in | Certain | Accepted | Framework-free domain layer is the only portable asset; an exit would be a rewrite of infrastructure. Accepted consciously — record as ADR-001 |
| R-6 | Search quality complaints at scale | High (year 2) | Low | Budget Algolia/Typesense integration as a known Phase-2 line item, not a surprise |
| R-7 | Trigger fan-out costs as attendance volume grows (write amplification: 1 attendance mark → roll-up → stats) | Medium | Low | Monitor read/write amplification monthly (Doc 11 §8); batch session-close roll-ups if needed |
| R-8 | **Multi-country data residency forces per-region projects** | Low now | **High** | The one roadmap item that breaks the single-project assumption. If international expansion becomes real, commission a residency assessment *before* signing commitments — flagged to steering committee |

## 4. Scalability Bottlenecks (ranked)

1. **Counters as single documents** (`counters/participantId`): Firestore caps ~1 sustained write/sec/doc. Admissions will never approach this (dozens/day), but *receipt numbers during a fee-collection drive* might spike. Verdict: fine now; if bulk imports ever happen, use a sharded counter or preallocate ranges. Documented so nobody "fixes" it prematurely.
2. **Dashboard stats docs** as hot write targets from multiple triggers — contention under burst attendance entry. Mitigation already designed (per-period docs); watch, don't pre-optimize.
3. **Audit volume**: auditLogs will be the largest collection by an order of magnitude. Cost is storage (cheap) not reads (indexed, paginated). Add a TTL/archive policy decision to the retention register conversation (Doc 03 §8 open question 2).
4. **Participant profile read amplification**: the profile screen touches many subcollections. Per-tab fetching (Doc 11 §3) contains it; keep the overview tab to ≤ 10 reads.

## 5. Security Risks (residual, after Doc 10 controls)

| # | Residual risk | Response |
|---|---|---|
| S-1 | Insider with legitimate access exfiltrating data (the realistic threat for this org size) | Export actions audited + `module:export` restricted; monthly audit review by system_admin is a **process** control — put it in the go-live SOP |
| S-2 | Session cookie theft on shared/office computers | 5-day cookie is long for shared machines; add idle-timeout re-auth for `finance` and `system_admin` surfaces (cheap, high value) — **added to Milestone 1 scope** |
| S-3 | `createLead` abuse despite rate limits (data pollution) | Leads are soft-quarantined: `source: website` leads enter stage `new` and dedupe; add a bulk-spam triage tool only if reality demands |
| S-4 | Rules `get()` calls for row-level checks add cost & complexity; a mistake fails open only if a predicate is mis-written | Rules tests must include **negative cases per role** (deny tests), not just allow tests — already in Doc 09 CI gates; keep it enforced |
| S-5 | Provisioning flow (temp passwords) intercepted | Use Firebase email-link first-login instead of admin-communicated temp passwords — **adopted now**, supersedes Doc 10 §1 temp-password mention |

## 6. Conditions for Approval (recommended, all cheap)

- **C-1 · Rules codegen before first business collection.** The `permissions.ts → rules predicates` generator + drift check in CI lands in Milestone 1, not later. Until then, no client-writable business collections exist (users/audit/settings are Function-written anyway).
- **C-2 · BR-03 recomputes at issuance.** Certificate eligibility always recomputed from raw attendance/assessment docs in the issuing transaction; roll-ups are display-only. Write this into the certificates feature plan verbatim.
- **C-3 · Staging project.** Create `terranextglobal-staging` at scaffold time; CI deploys rules/functions there on every merge, production on tagged release.
- **C-4 · ADR-001 lock-in acceptance.** One page recording that Firestore coupling is accepted deliberately, with the framework-free domain layer as the portability boundary — so the decision is owned, not ambient.

## 7. Improvement Recommendations (non-blocking)

1. Idle-timeout re-auth for high-privilege surfaces (S-2) — fold into Milestone 1 auth work.
2. Email-link first login (S-5) — replaces temp passwords; less admin friction too.
3. Add a `docs/adr/` folder with ADR-001 (Firestore lock-in) and ADR-002 (flat roles, no hierarchy) at scaffold time.
4. Budget alerts + App Check enforcement day one (W-5).
5. Schedule the escalation-rules workshop with Operations (R-3) in parallel with Milestone 1 — it is the largest unspecified requirement and it blocks Phase 10/12 depth.

## 8. Traceability Confirmation

BR-01 → participants/enrolments model (03 §1.4) · BR-02 → counselling gate in convertLead (03 §1.3, 10 §2) · BR-03 → programme certificateRules + C-2 · BR-04 → transactional capacity check (03 §1.2) · BR-05 → onCertificateIssued trigger (03 §1.6) · BR-06 → audit strategy (03 §6, 10 §7) · BR-07 → createLead Function (01 §1) · BR-08 → schema-constrained zero fee (03 §1.6, 10 §3) · BR-09 → careerProfiles.eligibility, placement-role-only (03 §1.6, 04 §3). All nine business rules have a named structural home. Roles (8) match BRD Section 18. NFRs mapped in Docs 10–11.
