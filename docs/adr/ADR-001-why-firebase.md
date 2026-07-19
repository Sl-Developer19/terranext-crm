# ADR-001 — Why Firebase?

Status: **Accepted** · Date: 2026-07-19 · Deciders: Lokesh (owner), Claude (co-engineer)

## Context
TerraNext has no dedicated ops/infra staff, yet the NFRs demand 99.5% uptime, daily backups, encrypted transport/storage, MFA-capable auth, and 10× participant growth without redesign (BRD §22). The public website is already deployed on Firebase App Hosting under project `terranextglobal`. The team optimizes for product velocity with a small engineering footprint.

## Decision
Build the entire backend on Firebase: Auth, Firestore, Storage, Cloud Functions, App Hosting — one managed platform, one project shared with the website.

## Alternatives Considered
1. **Supabase (Postgres)** — relational modelling and SQL reporting are genuinely better fits for the reporting phase; rejected because auth/rules/storage/functions maturity and the existing App Hosting investment favor Firebase, and the team's stack decree names Firebase.
2. **Self-managed Node + Postgres on a VPS** — maximum control, minimum cost at small scale; rejected: the uptime/backup/security NFRs would land on a team with no ops capacity.
3. **AWS Amplify/AppSync** — comparable managed offering; rejected for higher configuration complexity and no existing footprint.

## Pros
Managed auth with MFA and custom claims; security rules as a declarative authorization layer; zero-ops scaling and backups; tight Next.js integration via App Hosting; one billing/monitoring surface; emulator suite for local dev and rules testing.

## Cons
Vendor lock-in (see ADR-003); NoSQL modelling discipline required for a domain with relational shape; complex reporting will need pre-aggregation instead of SQL; costs scale with read amplification and must be watched (Doc 11 §8).

## Long-Term Impact
The platform choice is effectively permanent for this product generation. The portability boundary is the framework-free domain layer (Doc 01 A-3): schemas and business rules survive a platform change; infrastructure code does not. Every future capability (portals, mobile, AI) must be designed Firebase-first (Doc 12).
