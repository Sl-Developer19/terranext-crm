# ADR-002 — Why Separate Website & CRM Applications?

Status: **Accepted** · Date: 2026-07-19 (user-approved at milestone selection)

## Context
The public marketing website already exists (`terranext/`, Next.js, App Hosting backend `terranext-production`). The CRM is an authenticated internal platform for 8 staff roles. Both need the same participant data (BRD §20 three-layer architecture). Options ranged from one app with route groups to a full monorepo.

## Decision
The CRM is a **separate Next.js application** (`crm/`, its own App Hosting backend `terranext-crm`) sharing the same Firebase project. No monorepo restructuring now.

## Alternatives Considered
1. **Single app, `(admin)` route group** — fastest start; rejected: couples public SEO surface with the internal bundle, one deploy risks both surfaces, and contradicts the portal-per-app future (Doc 12 §1).
2. **Monorepo (apps/website, apps/crm, packages/shared)** — best long-term code sharing; rejected *for now*: requires migrating the live website first (~a day of restructuring plus deploy re-verification) before any CRM value ships. Revisit when a third app (portal) makes shared packages pay for themselves.

## Pros
Independent deploy/rollback blast radius; security rules and session handling written for staff-only clients; public site keeps its performance budget; CRM outages never take marketing down; clean claims namespace separation.

## Cons
Domain schemas exist in the CRM repo and the website cannot import them directly yet — the `createLead` Function's input contract is the interface (Doc 20/API Contract); modest duplication of Firebase config; future shared-package extraction cost remains.

## Long-Term Impact
Sets the pattern for every future surface: **one app per audience, one shared data layer** (student portal, employer portal, mobile all follow it). The monorepo decision is deferred, not rejected — trigger point is the first portal build.
