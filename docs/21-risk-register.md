# 21 — Project Risk Register

**TerraNext Business OS · Architecture Hardening**
Formal register consolidating Doc 13 findings + project-level risks. Owners: **PO** = Lokesh (product/engineering owner) · **CTO** = CTO office (client side) · **Ops** = Operations Manager · **SC** = Steering Committee. Review cadence: register revisited at every milestone close (Doc 22).

**Scales:** Probability & Impact — Low / Medium / High. Severity = P×I judgment, drives ordering.

| ID | Risk | P | I | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| RR-01 | **Permission map drift** between code, rules, settings mirror before codegen exists | High | High | C-1: codegen + CI drift-check lands in Milestone 1; until then zero client-writable business collections | PO | Open — gated to M1 |
| RR-02 | **Stale roll-ups used for certificate decisions** (eventual consistency vs BR-03) | Medium | High | C-2: issuance transaction recomputes from raw docs; roll-ups display-only — contract written into Doc 15/19/20 | PO | Mitigated by design; verify in M5 tests |
| RR-03 | **Escalation/notification rules unspecified** (missed sessions, at-risk attendance) — largest unspecified requirement | High | Medium | Ops workshop scheduled parallel to M1; Phase 10/12 mini-blueprint before M4 (attendance) ships alerts | Ops | Open — action pending |
| RR-04 | **Brand guidelines late/divergent** | Medium | Low | Token isolation (Doc 07); no high-fidelity marketing-adjacent UI until assets arrive | CTO | Open — chase dependency |
| RR-05 | **Payment gateway undecided** | Medium | Medium | Ledger/method separation (ADR-012, Doc 12 §5); manual receipts fully functional without gateway; no gateway UI until chosen | CTO | Open |
| RR-06 | **Single shared Firebase project blast radius** (website + CRM) | Medium | Medium | App Check both apps, createLead rate limits, budget alerts day one (Doc 13 W-5); staging project C-3 for risky changes | PO | Mitigation lands M1 |
| RR-07 | **No staging environment** for rules/index/trigger verification | High | Medium | C-3: `terranextglobal-staging` created at scaffold; CI deploys there per merge | PO | Open — gated to M1 |
| RR-08 | **Multi-country data residency** breaks single-project assumption | Low | High | Residency assessment before any international commitment (ADR-005/010 boundaries documented) | SC | Accepted — tripwire defined |
| RR-09 | **Insider data exfiltration** (realistic top threat at this org size) | Medium | High | Export permission + audit on every export; monthly audit review in go-live SOP; field-scoped projections | Ops | Mitigated; process control at go-live |
| RR-10 | **Search quality ceiling** (prefix tokens) at 10× scale | High | Low | Algolia/Typesense budgeted as known Phase-2 item; searchTokens adequate for launch volumes | PO | Accepted for phase 1 |
| RR-11 | **Counter hot-spots** under bulk operations (receipts during fee drives, imports) | Low | Medium | Documented limit (~1 write/s/doc); sharding/preallocation recipe in Doc 13 §4.1; no bulk-import feature without it | PO | Accepted — recipe ready |
| RR-12 | **Single developer dependency** (bus factor 1 on both product and platform) | High | High | This blueprint set is the mitigation: decisions, contracts, and conventions externalized; conventional commits + ADR discipline keep history legible for a successor | PO/SC | Accepted — structural |
| RR-13 | **Scope creep vs BRD** (features invented mid-build) | Medium | Medium | Workflow gate: every feature cites BRD/SOP source or is flagged as assumption for approval (session working agreement) | PO | Controlled by process |
| RR-14 | **Content/config dependencies from client stall milestones** (programme catalogue, fee plans, templates — BRD §26 content-freeze assumption) | Medium | Medium | Milestone acceptance criteria name required client inputs 1 milestone ahead (Doc 22); seed data unblocks dev meanwhile | CTO/Ops | Open |
| RR-15 | **Claims model ceiling** (multi-role/per-branch arrays vs 1000-byte limit) | Low | Medium | Known redesign trigger documented (ADR-006); flat single-role holds for all named roadmap items except branch-manager-of-many | PO | Accepted |
| RR-16 | **Trigger failure silence** (missed alumni creation, stale roll-ups) | Medium | Medium | Dead-letter `systemEvents` + ops visibility (Doc 19 §5); self-healing full recomputes; BR-05 idempotent re-fire | PO | Mitigated by design |
| RR-17 | **Legal/compliance around placement claims** (BR-08 transparency, international placements) | Low | High | BR-08 structurally enforced; disclosure text owned by client legal; flag any placement-fee feature request to SC immediately | SC | Accepted — tripwire |
| RR-18 | **Actor-type boundary erosion** (GPMS, ADR-014) — a future rule written as bare `allow read: if isStaff();` (no role list) on a new collection would need re-auditing against Growth Partner tokens too; `isStaff()`/`isPartner()` must stay mutually exclusive by construction | Medium | High | ADR-014 documents the guarantee explicitly; every new collection's rules review must confirm partner-scoped collections use `isPartner()` and staff-oversight collections use the generated `can_*` predicates, never a bare base predicate alone | PO | Open — process control, re-check at every future collection added |

**Escalation rule:** any Open risk whose probability or impact rises a level gets raised to the owner within the week, not at milestone close. Any new High/High entry pauses feature work until triaged.
