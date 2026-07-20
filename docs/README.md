# TerraNext Business OS — Official Technical Architecture

Pre-development architecture and hardening documentation, produced before any code per the agreed workflow. Requirements source of truth: BRD v1.0, Academy Proposal, SOP Vol.2 Part D (consolidated in [../file.md](../file.md)).

## Blueprint Set (Phase A — approved)

| Doc | Contents |
|---|---|
| [01 — Project Architecture](01-project-architecture.md) | Solution/layered/module architecture, dependency diagrams, locked decisions A-1…A-5 |
| [02 — Folder Architecture](02-folder-architecture.md) | Full tree, naming, module boundaries, lint-enforced import rules |
| [03 — Database Blueprint](03-database-blueprint.md) | Firestore design, ERD, indexes, soft-delete/audit/versioning strategies |
| [04 — RBAC Blueprint](04-rbac-blueprint.md) | 8-role permission matrix, enforcement layers, future roles |
| [05 — Navigation Blueprint](05-navigation-blueprint.md) | Nav tree, route map, guards, portal alignment |
| [06 — UI Blueprint](06-ui-blueprint.md) | Layout, form/table/dialog standards, state standards |
| [07 — Design System Blueprint](07-design-system-blueprint.md) | Provisional tokens (brand pending), type, spacing, icons, breakpoints |
| [08 — Coding Standards](08-coding-standards.md) | TS baseline, naming, error taxonomy, logging, comments |
| [09 — Development Standards](09-development-standards.md) | Git/commit conventions, PR + review checklists, CI gates |
| [10 — Security Blueprint](10-security-blueprint.md) | Auth/authz flows, rules strategy, threat model, upload + audit flows |
| [11 — Performance Strategy](11-performance-strategy.md) | Firestore/query optimization, caching, pagination, budgets |
| [12 — Future Architecture](12-future-architecture.md) | Seams built now vs deferred, per roadmap capability |
| [13 — Architecture Review Report](13-architecture-review-report.md) | First review: weaknesses, risks, conditions C-1…C-4 (all accepted) |

## Hardening Set (Phase B)

| Doc | Contents |
|---|---|
| [ADR-001 … ADR-013](adr/) | Decision records: Firebase, app separation, Firestore lock-in (C-4), feature architecture, shared data layer, custom claims, immutable audit, privileged Functions, soft delete, multi-branch readiness, flat roles, integer paise, server-side login + lockout (amends Doc 10 §1) |
| [14 — Data Dictionary](14-data-dictionary.md) | Field-level reference: every collection, type, validation, example, index, security |
| [15 — Business Rules Matrix](15-business-rules-matrix.md) | BR-01…BR-09 × 10 engineering dimensions each |
| [16 — Screen Inventory](16-screen-inventory.md) | All ~30 screens: purpose, roles, components, actions, build-order dependencies |
| [17 — Component Inventory](17-component-inventory.md) | Reusable component catalogue + reuse guidelines |
| [18 — Firestore Rules Matrix](18-firestore-rules-matrix.md) | Per-collection access truth table + CI deny-test obligations |
| [19 — Cloud Function Inventory](19-cloud-function-inventory.md) | Every callable/action/trigger/schedule: permissions, transactions, audit, idempotency |
| [20 — API Contract](20-api-contract.md) | Service contracts (Zod-authoritative), error envelope, future REST mapping |
| [21 — Risk Register](21-risk-register.md) | RR-01…RR-17 with probability/impact/mitigation/owner/status |
| [22 — Implementation Roadmap](22-implementation-roadmap.md) | Milestones M1–M8: objectives, deliverables, acceptance criteria, client-input dependencies |
| [23 — Enterprise Architecture Review](23-enterprise-architecture-review.md) | **Final gate review: category scores, binding amendments, scaffold approval** |

## Status

- Phase A approved with conditions C-1…C-4 (accepted, folded into M1).
- Phase B complete; final review verdict: **approved for scaffolding upon owner sign-off**, with Doc 23 §3 amendments binding and one owner decision requested (two-tier workflow, Doc 23 §2 DX).
- Reading order for final sign-off: **23 → 22 → 21**, spot-check 14/18/20.

## Maintenance Rules

Blueprints are living documents: any PR that changes a documented decision updates the blueprint and/or adds an ADR **in the same PR** (Doc 09 §4). The PR template's "blueprints touched" line is the enforcement point.
