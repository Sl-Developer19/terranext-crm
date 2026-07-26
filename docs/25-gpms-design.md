# Doc 25 — Growth Partner Management System (GPMS) Design

Status: **Approved for build** · Date: 2026-07-26 · Extends Docs 02–22, ADR-014

Growth Partners are external referral partners: they register, get approved,
refer leads, and earn configurable rewards when a referred lead is admitted
and pays. They never see another partner's data. This doc is the design
record the pasted GPMS brief asked for; kept lean per the "speed with
quality" pivot — no new architecture beyond what a new actor type genuinely
requires.

## 1. Key adaptation from the brief

The brief's Firestore list (`partnerLeads`, `students`, `applications`,
`payments`) would fork the acquisition/admission/payment pipeline that
already exists (`leads` → `counsellingSessions` → admissions conversion →
`participants` → `feeAccounts/payments`, Docs 03/14). Forking it would
violate "reuse existing CRM modules, never duplicate code" and would give
BR-07 (no enquiry ever lost) two lead pipelines to keep consistent.

**Decision:** a referral is an ordinary `leads` document with `source:
'referral'` and a new `partnerId`/`partnerName` pair (same shape as the
existing `assignedToUid`/`assignedToName` fields). It rides the existing
pipeline unmodified. Only the concepts with no existing analog are new
collections: partner identity, reward rules, reward ledger, wallet, payouts.

## 2. Roles (mapped onto existing `StaffRole`s, ADR-014)

| Brief role | System role | Notes |
|---|---|---|
| Founder | `founder` | unchanged, unrestricted |
| System Admin | `system_admin` | + `growthPartners:*`, `rewards:configure` |
| Operations Admin | `ops_manager` | already owns `leads:assign`, `admissions:*` |
| Finance | `finance` | + `rewards:approve` (payouts), `growthPartners:view` |
| Admission Team | `ops_manager` | same grants as Operations Admin — no new row |
| Growth Partner | **new actor type**, not a `StaffRole` — see ADR-014 | |

## 3. Firestore collections

New:
- `growthPartners/{partnerId}` — profile, status (`pending_approval` |
  `active` | `suspended` | `rejected`), leadershipLevel, contact, documents,
  `authUid` (Firebase Auth uid once approved).
- `rewardRules/{ruleId}` — `{ programmeId | 'ALL', kind: 'flat' | 'percent',
  amountPaise | percentBps, active, effectiveFrom }`. Configurable, never
  hardcoded (brief requirement) — read by the reward-computation step.
- `rewardLedger/{ledgerId}` — one immutable entry per reward event: `{
  partnerId, leadId, participantId, feeAccountId, paymentId, ruleId,
  amountPaise, status: 'accrued' | 'paid', createdAt }`. Append-only, same
  immutability posture as `auditLogs` (ADR-007).
- `wallets/{partnerId}` — running `balancePaise`, updated only inside the
  same transaction that writes a `walletTransactions` entry (never a bare
  counter write — same rationale as `batches.enrolledCount`).
  - `wallets/{partnerId}/transactions/{txId}` — `{ kind: 'credit' | 'debit',
    amountPaise, reason, refLedgerId | refPayoutId, createdAt }`.
- `payoutRequests/{payoutId}` — `{ partnerId, amountPaise, status:
  'requested' | 'approved' | 'rejected' | 'processing' | 'paid', requestedAt,
  decidedBy, decidedAt }`.
- `partnerNotifications/{partnerId}/items/{id}` — same shape as an in-app
  notification, scoped per partner.

Extended (existing collections, additive fields only):
- `leads/{leadId}`: `+ partnerId: string | null`, `+ partnerName: string |
  null` (mirrors `assignedToUid`/`assignedToName`).
- `participants/{participantId}`: `+ partnerId: string | null` (propagated
  from the originating lead at admission conversion, Doc 03 §1.4).
- `feeAccounts/{id}/payments/{paymentId}`: unchanged shape; the *reward
  computation* is an added step inside the existing `recordPaymentRecord`
  transaction (slice 4), not a new payments collection.

## 4. Workflow (brief's diagram, mapped onto existing steps)

```
Growth Partner registers          → growthPartners doc, status=pending_approval
Ops Admin / System Admin approves → status=active, Firebase Auth user + custom claim minted
Growth Partner submits a lead     → leads doc (source=referral, partnerId set)   [existing pipeline]
Ops team runs counselling         → counsellingSessions                          [existing pipeline]
Admission conversion              → participants doc (partnerId propagated)      [existing pipeline]
Finance records payment           → feeAccounts/payments                        [existing pipeline]
  └─ same transaction: reward rule matched → rewardLedger entry → wallet credited → partner notified
Founder/Finance approve payout    → payoutRequests status → paid, wallet debited
```

## 5. Security (Firestore rules)

- Staff oversight reads use the existing generated `can_growthPartners_view()`
  / `can_rewards_view()` predicates (C-1 codegen), same as every other module.
- Partner reads use `isPartner()` (ADR-014) plus a `partnerId == resource.data.partnerId`
  (or `== resource.id` for `growthPartners`/`wallets`) equality check on every
  partner-scoped collection — the brief's "partnerId == loggedInPartnerId"
  requirement, enforced identically to how `leads` already row-scopes
  consultants by `assignedToUid`.
- All writes remain Admin-SDK-only via server actions (existing platform
  convention) — a partner never writes Firestore directly, including their
  own wallet or reward ledger.

## 6. Navigation

- Staff nav: new "Growth Partners" group (Partners, Reward Rules, Payouts) —
  gated by `growthPartners:view` / `rewards:view`, same `NAV_GROUPS` /
  `visibleModules()` mechanism as every existing group.
- Partner portal: separate route group `/partner/*` with its own minimal
  shell (Dashboard, My Leads, My Rewards, Wallet, Profile, Notifications) —
  no access to `/dashboard`, `/leads`, etc.; enforced by `requirePartnerSession()`
  returning nothing but a partner session, and by staff routes'
  `requirePermission()` continuing to reject a partner token (no `StaffRole`
  claim resolves for it).

## 7. Build sequence

Tracked as slices 1–6 in this session's task list: (1) identity/RBAC/
registration, (2) partner portal auth + row-level rules, (3) referral lead
linkage, (4) payment-triggered reward engine + wallet, (5) payouts +
accounting, (6) dashboards + leaderboard. Each slice is a complete vertical
(schema → rules → actions → UI → tests) committed independently, per the
standing "speed with quality" delivery mode.
