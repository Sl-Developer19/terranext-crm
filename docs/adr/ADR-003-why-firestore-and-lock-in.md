# ADR-003 — Why Firestore? (Lock-in Accepted — Review Condition C-4)

Status: **Accepted** · Date: 2026-07-19 · Fulfills Doc 13 condition C-4

## Context
Within Firebase (ADR-001), the datastore options are Firestore, Realtime Database, or an external DB fronted by Functions. The domain is document-shaped at its core — one participant, one lifetime record with lifecycle subcollections (BR-01) — but has relational edges (batches↔participants, reporting).

## Decision
**Firestore in Native mode** is the single system of record, and its lock-in is consciously accepted. The Shared Participant Data Layer *is* a Firestore database.

## Alternatives Considered
1. **Realtime Database** — rejected: weak querying, no per-field rules ergonomics, poor fit for structured records.
2. **Cloud SQL behind Functions** — relational integrity and SQL reporting; rejected: forfeits security rules (all authz becomes hand-written middleware), adds an always-on cost and an ops surface, and breaks offline/realtime client features.
3. **Hybrid (Firestore + SQL replica for reporting)** — deferred, not rejected: if Phase 11 reporting outgrows pre-aggregation, a BigQuery export (built-in Firestore→BigQuery extension) is the sanctioned path — *additive*, no re-platforming.

## Pros
Security rules give a declarative, testable authorization layer at the data boundary (defense-in-depth layer 1, Doc 04 §4); document model matches the participant-record domain; offline cache, realtime listeners, transactions, `count()` aggregations; zero ops.

## Cons
No joins — read-optimized denormalization and trigger-maintained aggregates required (accepted, Doc 03/11); eventually-consistent roll-ups create the BR-03 recompute obligation (Doc 13 C-2); 1 write/sec/doc hot-spot limits (counters — mitigations documented); migration off Firestore would be an infrastructure rewrite.

## Long-Term Impact
The exit cost is real and accepted: domain schemas/logic are portable (framework-free layer), everything under `lib/firebase`, `paths.ts`, rules, and Functions is not. This ADR is the record that the trade was made deliberately, with the BigQuery export as the pressure valve for analytical workloads before any re-platforming conversation.
