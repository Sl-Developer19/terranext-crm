# ADR-005 — Why a Shared Participant Data Layer?

Status: **Accepted** · Date: 2026-07-19

## Context
BR-01 mandates "One Participant – One Lifetime Digital Record." BRD §20 defines three layers: Website, CRM, and a Shared Participant Data Layer both read/write against. The alternative pattern — each surface owning its data with synchronization — is common and commonly regretted.

## Decision
One Firestore database is the **only** store of participant/lead truth. Website, CRM, and every future portal are clients of it; no surface ever holds a copy requiring sync.

## Alternatives Considered
1. **Per-app databases + sync jobs** — rejected: sync is where duplicate participants are born; BR-01 would become a reconciliation aspiration instead of a structural fact.
2. **CRM owns data; website posts to a CRM API** — effectively what we do (createLead Function), but generalized "API-only" access for all surfaces was rejected for phase 1: staff CRM benefits from Firestore's client SDK (offline, realtime, rules) without an API middle tier to build and operate.
3. **Event-sourced central log with projections** — rejected (Doc 12 §7): operational overkill; auditLogs + timeline deliver the traceability the BRD asks for.

## Pros
BR-01 enforced physically — a duplicate record requires *creating* it, not merely failing to sync; one security-rules surface governs all access; portals become read-lens work, not integration projects; single backup/retention story (SOP 17 registers).

## Cons
Shared blast radius across surfaces (Doc 13 W-5 — mitigated by App Check, rate limits, budget alerts); schema changes must consider every consumer — `schemaVersion` + tolerant readers (Doc 03 §7) is the discipline that keeps this safe.

## Long-Term Impact
This is the platform's central bet: every roadmap item in Doc 12 assumes it. The one scenario that breaks it is per-country data residency (Doc 13 R-8), which would shard the layer by region — flagged to the steering committee as the pre-commitment check.
