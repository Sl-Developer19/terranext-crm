# ADR-004 — Why Feature-Based Architecture?

Status: **Accepted** · Date: 2026-07-19

## Context
The BRD defines 20 modules (Master Doc Phase 08) built over many milestones by a small team. The codebase must stay navigable as it grows to dozens of screens, and modules map 1:1 to business capabilities that stakeholders reason about.

## Decision
Organize `src/` by **feature packages** (`features/leads`, `features/participants`, …), each owning its components, hooks, actions, schemas, logic, and Firestore paths, with a single public `index.ts` (Doc 02).

## Alternatives Considered
1. **Layer-first (`components/`, `hooks/`, `services/` global folders)** — rejected: every feature change touches four distant folders; ownership and deletion boundaries blur precisely as module count grows.
2. **Full DDD with bounded contexts as packages (npm workspaces)** — rejected as ceremony for one app; the feature folder + lint-enforced boundaries capture the same isolation at near-zero tooling cost.
3. **Route-colocated everything (all code under `app/`)** — rejected: couples domain logic to routing, blocks reuse by Functions and future portals.

## Pros
Business-to-code traceability (a BRD module = a folder); enforced boundaries via `eslint-plugin-boundaries` (Doc 02 §5); features are deletable/flag-gated units; parallel work without merge collisions; `logic.ts` isolation makes BR rules unit-testable.

## Cons
Cross-feature reads need discipline (only via public hooks) — the lint rule is the guardrail; some judgment calls on where shared domain types live (resolved: `src/types` for cross-feature identity/tenancy only).

## Long-Term Impact
The feature public-API convention is what lets the dashboard, reports, and future AI retrieval compose read models without spaghetti. If the team grows, features are the natural ownership and code-review boundaries.
