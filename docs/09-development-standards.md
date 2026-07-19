# 09 — Development Standards

**TerraNext Business OS · Architecture Blueprint**

---

## 1. Git Strategy

- One repository for the CRM (`crm/`), initialized at scaffold time. (The website stays in its own tree; if we later monorepo them, that is an ADR + migration, not an ambient drift.)
- `main` is always deployable to production; protected — no direct pushes.
- Trunk-based with short-lived branches (< ~3 days of work). Long-running feature branches are the failure mode to avoid; large modules land behind feature flags (`config/feature-flags.ts`) in small PRs.

## 2. Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | production; every merge is releasable |
| `feat/<module>-<slug>` | feature work (`feat/leads-followup-queue`) |
| `fix/<slug>` | bug fixes |
| `docs/<slug>` · `chore/<slug>` | blueprints/ADRs · tooling |
| `hotfix/<slug>` | production emergency; merged back to `main` immediately |

No `develop` branch — with one deployable app and App Hosting preview channels per PR, a staging branch adds ceremony without safety.

## 3. Commit Convention

Conventional Commits, enforced by commitlint:

```
<type>(<scope>): <imperative summary ≤ 72 chars>

[body: what & why, BR/FR references]
```

- Types: `feat` `fix` `docs` `refactor` `perf` `test` `chore` `security`.
- Scope = feature/module name (`feat(leads): add duplicate check on phone (FR-01.4)`).
- Business-rule work references the rule id in the body — traceability from BRD to commit history.
- Breaking schema changes: `feat(participants)!:` + `schemaVersion` bump + migration note.

## 4. Pull Request Checklist (PR template)

- [ ] Linked plan/issue; states which blueprint sections it implements
- [ ] Screenshots/recording for UI changes (light + dark, mobile if flow is mobile-critical)
- [ ] New/changed Firestore queries list their indexes; `firestore.indexes.json` updated
- [ ] Security rules updated **in the same PR** as any new collection/field written by clients
- [ ] `withAudit` on every business mutation (BR-06)
- [ ] Zod schema + rules + UI validation agree (one schema, three points)
- [ ] Loading / empty / error states implemented for new surfaces
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green; rules tests updated if rules changed
- [ ] No secrets, no `console.log`, no TODO comments
- [ ] Blueprint/ADR updated if a documented decision changed

## 5. Code Review Checklist (reviewer's lens, in priority order)

1. **Correctness vs BRD** — does it implement the referenced BR/FR, and only that? Any invented business rule is a blocker.
2. **Security** — rules deny-by-default preserved? Permission check present server-side (not just `useCan`)? Any client-trusted field that rules don't validate?
3. **Audit** — would this change leave a participant/lead/financial mutation untraceable? (BR-06)
4. **Data integrity** — transactions where invariants span docs (capacity BR-04, counters)? Soft-delete respected? Denormalized fields have an owner/refresh path?
5. **Boundaries** — imports respect Doc 02 §5? Business logic in `logic.ts`, not components?
6. **UX standards** — Doc 06 states present? a11y (labels, focus, keyboard)?
7. **Simplicity** — could this be less code? Duplication of an existing component/hook?

Review SLA: same working day. Two approvals for: security rules, RBAC map, counters/ID generation, payment paths. One approval elsewhere.

## 6. Quality Gates & Releases

- CI on every PR: typecheck, lint, unit tests (`logic.ts`), Firestore rules tests (emulator), build. Red CI = unmergeable.
- Deploys: merge to `main` → App Hosting rollout to `terranext-crm`; rules/indexes/functions deployed via CI step (`firebase deploy --only firestore,functions`) so code and rules never drift.
- Rollback: App Hosting previous-rollout restore + rules revert commit — rehearsed once before go-live (Phase 16 dependency).
- Tags `vX.Y.Z` at each announced release; CHANGELOG generated from conventional commits.
