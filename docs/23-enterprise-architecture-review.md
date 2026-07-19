# 23 — Enterprise Architecture Review (Final, Pre-Scaffold)

**TerraNext Business OS · Gate review over Docs 01–22 + ADR-001…012**
Stance: final adversarial pass before implementation is authorized. Scores are earned against *this project's* stated ambitions (enterprise platform, multi-year horizon, solo-builder reality) — not against a hypothetical big-team ideal.

---

## 1. Scorecard

| Category | Score | One-line judgment |
|---|---|---|
| Security | **8/10** | Defense-in-depth is real; residual gaps are process, not design |
| Scalability | **8/10** | Right-sized; every known bottleneck named with a ready recipe |
| Performance | **8/10** | Read-optimized modelling + budgets; unproven until measured |
| Maintainability | **9/10** | The blueprint set itself is the asset; conventions are enforceable, not aspirational |
| Modularity | **9/10** | Feature boundaries lint-enforced; public-API convention is the standout |
| Developer Experience | **7/10** | Strong conventions, but heavy process per feature for a solo dev |
| Operational Readiness | **6/10** | Weakest area — deliberate, since most of it lands in M1/M8, but it is *planned*, not *built* |
| Future Expansion | **8/10** | Seams are specific and cheap; one honest unsolved case (residency) |
| **Overall** | **7.9/10** | **Approved to scaffold**, with the M1 gate items binding |

## 2. Category Notes — Weaknesses & Improvements

### Security — 8
**Strong:** flat roles with separation of duties (ADR-011); immutable audit incl. admins (ADR-007); Admin-SDK-only privileged writes; deny-test obligations enumerated per collection (Doc 18); BR-08 as a schema constraint.
**Weaknesses:** (a) client-batched audit ceiling (W-3) persists wherever client writes exist — contained, not eliminated; (b) rules codegen (C-1) is designed but unbuilt — until it exists in M1, security posture is a promise; (c) insider risk mitigations are process controls that depend on someone actually reviewing audits monthly.
**Improve:** make the monthly audit review a scheduled system artifact (auto-generated review digest to founder), not a calendar hope. *(Adopted into M8 hypercare deliverables.)*

### Scalability — 8
**Strong:** precomputed aggregates, cursor-only pagination, `branchId` + index design ready for 10× and multi-branch (ADR-010) without migration.
**Weaknesses:** single-doc counters (known, recipe ready); trigger write-amplification unmeasured; auditLogs unbounded growth pending retention policy.
**Improve:** add read/write-amplification measurement to M4 acceptance (attendance is the volume driver), not just the monthly review. *(Adopted.)*

### Performance — 8
**Strong:** ≤2s NFR mapped to concrete budgets (JS size, doc reads/screen, LCP); heavy bundles isolated behind dynamic imports; per-tab profile fetching.
**Weaknesses:** all targets are paper until Lighthouse CI runs; Firestore cold-cache behavior on low-end mobile (trainer flow) is the real-world unknown.
**Improve:** trainer attendance flow gets a low-end-device test in M4 acceptance — it is the only latency-sensitive daily flow. *(Adopted.)*

### Maintainability — 9
**Strong:** one decision, one home (ADRs); Zod as single-source validation; BR rules as named, cited functions; docs updated in-PR by checklist. This is the category the whole hardening phase purchased.
**Weakness:** 23 documents + 12 ADRs can rot if the update-in-PR discipline slips — the risk is documentation *debt*, ironically.
**Improve:** PR template line "blueprints touched: [list|none-needed]" makes the nothing-changed claim explicit and reviewable. *(Adopted into Doc 09 checklist.)*

### Modularity — 9
**Strong:** feature packages with lint-enforced boundaries and index-only imports; framework-free domain layer; dashboard/reports as composition of exported read models.
**Weakness:** cross-feature transaction flows (convertLead touches five features' data) live in one feature by convention (`admissions`) — acceptable, but the convention must be written down. *(Now it is: composite transactions belong to the feature that owns the triggering user intent.)*

### Developer Experience — 7
**Strong:** emulator-first local dev; typed end-to-end; conventions eliminate debate; codegen kills the most tedious drift class.
**Weaknesses:** the 11-step per-feature cycle is heavyweight for a solo developer and risks ritual compliance (checkbox theater) over substance; two runtimes (actions + Functions) demand context switching; emulator parity gaps (App Check, some Auth flows) will bite.
**Improve:** scale ceremony to change size — the full cycle for features, a documented short-form (analysis → security check → implement → test → docs) for small changes within an approved feature design. **Recommended for owner approval — this is a working-agreement change.**

### Operational Readiness — 6
**Weakest, knowingly.** Monitoring, alerting, staging, rollback rehearsal, incident runbook, backup verification are all *designed* (Docs 9/10/19/22) but nothing exists, and several land only at M8.
**Weaknesses:** (a) between M1 and M8 the system runs with partial observability; (b) backup/restore for Firestore (PITR + scheduled exports) is mentioned nowhere explicitly — a genuine gap in the blueprint set.
**Improve (binding):** add to M1: enable Firestore PITR + weekly export-to-bucket from day one, plus error reporting (client + Functions) — observability cannot wait for M8. *(Adopted — M1 scope amended.)*

### Future Expansion — 8
**Strong:** seams are enumerated per capability with explicit deferred-work lists (Doc 12); rejected-on-purpose list prevents speculative complexity; compatibility checklist for future plans.
**Weaknesses:** data residency (RR-08) genuinely unsolved — correctly escalated rather than hand-waved; monorepo/shared-schema extraction cost with the website will grow until the first portal forces it.
**Improve:** none required now; the tripwires are set.

## 3. Binding Amendments from This Review

1. **M1 additions:** Firestore PITR + scheduled exports; error reporting wired (client + server); audit-review digest job moved up from M8 where feasible.
2. **M4 acceptance additions:** low-end-device trainer flow test; amplification measurement.
3. **Doc 09 PR template:** explicit "blueprints touched" line.
4. **Owner decision requested:** two-tier workflow (full cycle for features, short-form for in-design changes) — recommended to keep rigor where it pays and velocity where it doesn't.

## 4. Verdict

The architecture is coherent, traceable, honestly self-critical, and right-sized for its team while structured for its ambitions. Remaining risk is concentrated in *execution* (building what is designed, especially C-1/C-3 and the M1 operational additions), not in *design*.

**Gate decision: APPROVED FOR SCAFFOLDING** upon owner sign-off, with §3 amendments binding and the M1 acceptance criteria (Doc 22) as the first checkpoint.
