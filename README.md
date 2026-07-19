# TerraNext Business OS — CRM

Enterprise operations platform for TerraNext Global Ventures: lead → counselling → admission → academic delivery → certification → placement → alumni, on one lifetime participant record.

- **Architecture (official, v1.0):** [docs/](docs/README.md) — blueprints 01–23 + ADRs. No architectural change without an ADR.
- **Stack:** Next.js App Router · TypeScript (strict) · Tailwind + ShadCN · Firebase (Auth/Firestore/Storage/Functions) · TanStack Query · Zustand · Zod.
- **Firebase project:** `terranextglobal` (shared with the public website — ADR-002/005).

## Development

```bash
npm install          # also sets up husky hooks (prepare)
cp .env.example .env.local   # fill from Firebase console
npm run dev
```

Quality gates (all enforced in CI and pre-commit):

```bash
npm run typecheck    # tsc strict
npm run lint         # eslint incl. module-boundary rules (Doc 02 §5)
npm run test         # vitest
npm run format:check # prettier
npm run analyze      # bundle analyzer (Doc 11 budgets)
```

Commits follow Conventional Commits (`commitlint`, Doc 09 §3). Branches: `feat/<module>-<slug>`, `fix/<slug>`, `docs/<slug>` off `main`.

## Workflow

Two-tier engineering workflow (approved 2026-07-19):

- **Tier 1** (modules, database, security, workflows, APIs, auth, reporting, notifications): full lifecycle — requirement → business analysis → architecture review → database design → security review → UI/UX → implementation → testing → self-review → docs update → commit.
- **Tier 2** (UI refinements, bug fixes, copy, styling, small validations): quick analysis → security check → implementation → testing → docs-if-needed → commit. Never for changes touching business rules, schema, permissions, workflows, or architecture.
