# 14 — Data Dictionary

**TerraNext Business OS · Architecture Hardening**
Authoritative field-level reference for every Firestore collection (design source: Doc 03). Security column references Doc 18 (Firestore Rules Matrix); indexes reference Doc 03 §3.

**Legend:** R = required · O = optional (explicit `null`, never missing) · ts = Firestore Timestamp

## 0. Base Envelope (every document, all collections)

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| schemaVersion | number | R | int ≥ 1, current per `schema-versions.ts` | `1` |
| branchId | string | R | known branch key (ADR-010) | `"HQ"` |
| createdAt / updatedAt | ts | R | `== request.time` on create/update | — |
| createdBy / updatedBy | string | R | `== auth.uid` or `"system"` | `"uid_8f3…"` |
| deletedAt | ts\|null | R | null unless soft-deleted (ADR-009) | `null` |
| deletedBy | string\|null | R | uid when deletedAt set | `null` |

Envelope fields are validated in rules and applied by the shared converter — features never write them manually.

---

## 1. `users/{uid}` — staff profile (mirror of claims)

Doc ID = Firebase Auth UID · Writes: Functions only · Related: batches.trainerUid, all `*By` fields

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| displayName | string | R | 2–80 chars | `"Priya N"` |
| email | string | R | email, unique (Auth-enforced) | `"priya@terranext.in"` |
| phone | string | R | E.164 | `"+919876543210"` |
| role | string | R | one of 8 role keys (Doc 04) | `"trainer"` |
| status | string | R | `active\|disabled` | `"active"` |
| assignedBatchIds | string[] | R | batch doc ids; `[]` for non-trainers | `["btc_01"]` |
| photoUrl | string\|null | O | Storage path under `users/{uid}/` | `null` |
| mustChangePassword | boolean | R | — | `false` |
| lastLoginAt | ts\|null | O | set by session endpoint | — |

Indexes: (deletedAt, displayName) — directory listing (S50); (role, status, deletedAt) — active-System-Administrator count guard (`features/users/logic.ts` wouldStrandPlatform, Doc 19 setUserRole/setUserStatus).

Future: FCM token subcollection for push (Doc 12 §2).

## 2. `settings/{key}` — fixed config docs

Keys: `roles` (read-only display of the code permission map + map version hash), `general` (org name, contacts), `idFormats` (prefixes/patterns for IDs), `notificationTemplates` (Phase 10). Writes: `system_admin` via Functions; `roles` written only by CI codegen (C-1).

## 3. `counters/{name}` — transactional sequences

Names: `participantId`, `certificateNo`, `receiptNo` (receiptNo resets per FY). Fields: `current` (int ≥ 0), `prefix` (string), `year` (int). Writes: inside Admin-SDK transactions only. Bottleneck note: Doc 13 §4.1.

## 4. `auditLogs/{id}` — immutable audit trail (ADR-007)

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| at | ts | R | `== request.time` | — |
| actorUid | string | R | `== auth.uid` (client) or uid/`"system"` (admin) | — |
| actorRole | string | R | role key | `"ops_manager"` |
| action | string | R | `create\|update\|soft_delete\|status_change\|permission_change\|login\|export\|override\|migration` | `"status_change"` |
| entityType | string | R | known entity key | `"lead"` |
| entityId / entityPath | string | R | — | `"leads/ld_42"` |
| changes | map\|null | O | `{field: {before, after}}` diff | `{"stage":{"before":"hot","after":"admitted"}}` |
| context | map | R | `{feature, reason}`; reason **required** when action=`override` | — |

Indexes: (entityType, entityId, at desc), (actorUid, at desc). No envelope soft-delete fields apply (never deletable).

## 4b. Login-Security Ledger (server-only, ADR-013)

Admin-SDK-only; explicit deny-all rules blocks (Doc 18). Timestamps stored as Firestore `Timestamp`, exposed to policy code as epoch ms.

**`loginSecurity/{emailHash}`** — doc ID = `sha256(normalized email)`; no plain addresses in the ledger

| Field | Type | Req | Validation / Notes |
|---|---|---|---|
| emailHash | string | R | 64-hex |
| failedAttempts | number | R | int ≥ 0; decays per A1 (30 min) |
| lastFailedAt / lockedUntil | ts\|null | R | lock computed from tier table (config/auth-security) |
| lastSuccessfulLogin / lastLoginIp / lastUserAgent | ts\|null / string\|null | R | success metadata only |

**`loginAttempts/{autoId}`** — the SOP 17.16 System Access Log register: `at`, `email` (plain, register requirement), `emailHash`, `success`, `ip`, `userAgent`, `reason` (`ok|invalid_credentials|locked|disabled|not_provisioned|mfa_required|provider_error`). Append-only.

**`securityEvents/{autoId}`** — high-signal incidents (`LOGIN_LOCKOUT`, …): `at`, `type`, `severity` (`low|medium|high|critical`), `emailHash`, `ip`, `userAgent`, `details`. Append-only, immutable.

## 5. `academies/{id}`

`name` (R, 2–80), `slug` (R, kebab, unique), `description` (O), `status` (R, `active|archived`). Example: Gen Z Career Readiness Academy.

## 6. `programmes/{id}`

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| academyId | string | R | existing academy | — |
| name / code | string | R | code unique, uppercase | `"GENZ48"` |
| durationDays | number | R | int > 0 | `48` |
| sessionCount | number | R | int > 0 | `48` |
| eligibility | string | R | free text | `"Age 16–24"` |
| curriculumSummary | string | O | — | — |
| certificateRules | map | R | `{minAttendancePct: 0–100, minAssessmentScore: ≥0}` (BR-03) | `{minAttendancePct: 80, …}` |
| feePlanDefault | map | R | `{totalPaise int≥0, installments[]: {label, amountPaise, dueOffsetDays}}`; installment sum == total | — |
| status | string | R | `active\|archived` | — |

## 7. `batches/{id}`

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| programmeId / academyId | string | R | denorm pair, consistent | — |
| code | string | R | unique, pattern from `idFormats` | `"GENZ48-2026-B03"` |
| startDate / endDate | ts | R | end > start | — |
| capacity | number | R | int 1–200 | `30` |
| enrolledCount | number | R | int ≥ 0, ≤ capacity (BR-04, transaction-maintained) | `27` |
| trainerUid | string | R | user with role trainer | — |
| schedule | map | R | `{days: string[], startTime, endTime}` "HH:mm" | — |
| status | string | R | `planned\|running\|completed\|cancelled` | — |

Subcollection **`sessions/{id}`**: `date` (ts R), `topic` (string O), `trainerUid` (R), `status` (`scheduled|held|cancelled`), `heldAt` (ts|null).
Sub-subcollection **`sessions/{sid}/attendance/{participantId}`**: `participantId`/`batchId`/`programmeId` (R, duplicated for collection-group queries), `status` (`present|absent|late|excused`), `markedBy` (R uid), `markedAt` (ts R). CG indexes: (participantId, markedAt desc), (batchId, status).

## 8. `leads/{id}` — never deleted, never merged away (BR-07)

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| name | string | R | 2–80 | `"Arjun K"` |
| phone | string | R | E.164; dedupe key (FR-01.4) | `"+9198…"` |
| email | string\|null | O | email format | — |
| source | string | R | `website\|campaign\|referral\|college\|walk-in\|social` | `"college"` |
| sourceDetail | map | R | keys per source: campaignId / collegeId+campusLeaderId / referrerParticipantId; `{}` allowed | `{"collegeId":"clg_7"}` |
| programmeInterestId / academyId | string\|null | O | existing docs | — |
| stage | string | R | `new\|contacted\|counselling_booked\|counselling_attended\|hot\|admitted\|lost\|follow_up`; transitions validated in logic.ts | — |
| assignedToUid | string\|null | O | staff uid | — |
| nextFollowUpAt | ts\|null | O | required when stage=`follow_up` | — |
| lostReason | string\|null | O | required when stage=`lost` | — |
| participantId | string\|null | O | set once by convertLead; immutable after (rules `unchanged`) | `"TNX-2026-00042"` |
| consent | map | R | `{given: true, at: ts, textVersion}` — creation rejected without consent | — |

Subcollection **`activities/{id}`**: `type` (`call|note|stage_change|followup`), `summary` (R ≤ 500), `at` (ts R), `byUid` (R). Client-writable (rules-validated).
Indexes: (stage, nextFollowUpAt), (assignedToUid, stage, updatedAt desc), (sourceDetail.collegeId, createdAt desc), phone, email.

## 9. `counsellingSessions/{id}`

`leadId` (R), `consultantUid` (R), `heldAt` (ts R), `mode` (`in_person|phone|video`), `notes` (R ≤ 4000), `needsAssessment` (string O), `recommendation` (map|null: `{programmeId, remarks}`), `outcome` (R `recommended|not_suitable|follow_up`). BR-02: outcome `recommended` requires non-null recommendation (rules + logic). Index: (leadId, heldAt desc).

## 10. `colleges/{id}` + `campusLeaders/{id}` (sub)

College: `name` (R), `city` (R), `contactPerson`/`phone` (O), `status` (`active|archived`). Leader: `name` (R), `phone` (R E.164), `participantId` (O — leaders may be participants), `active` (bool R). Serves college-wise reports (Phase 11).

## 11. `participants/{id}` — the lifetime record (BR-01)

Doc ID = Participant ID from counter, pattern `TNX-YYYY-NNNNN`. Created only by `convertLead`.

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| leadId | string | R | immutable; the converting lead | — |
| personal | map | R | `{fullName R, dob ts R, gender O, phone R E.164, email O, address O, emergencyContact {name, phone, relation} R}` | — |
| family | map | R | `{parentName O, parentPhone O, familyRecordId O}` (reserved, Doc 03 §8 Q3) | `{}` ok |
| status | string | R | `active\|completed\|alumni\|withdrawn`; `alumni` set by trigger (BR-05) or audited override | — |
| currentEnrolmentId | string\|null | O | — | — |
| tags | string[] | R | ≤ 20 tags | `[]` |
| searchTokens | string[] | R | generated lowercase prefixes (name/phone); server-maintained | — |

Subcollections:
- **`enrolments/{id}`**: `programmeId/academyId/batchId` (R), `enrolledAt` (R), `status` (`orientation|in_progress|completed|dropped`), `attendancePct` (0–100, trigger-maintained, **display-only** — C-2), `assessmentSummary` (`{attempted, passed, avgScore}`), `certificateId` (string|null), `completedAt` (ts|null). CG index: (batchId, status).
- **`timeline/{id}`**: `type` (R event key), `refPath` (R), `summary` (R ≤ 200), `at` (R), `byUid` (R). Append-only.
- **`documents/{id}`**: `kind` (`photo|id_proof|resume|passport|other`), `storagePath` (R, must match doc id path), `fileName` (R), `sizeBytes` (R ≤ 10MB), `contentType` (allow-list), `status` (`pending|ready|rejected`), `uploadedBy` (R). Anchors the upload flow (Doc 10 §6).

## 12. `assessments/{id}` + `scores/{participantId}` (sub)

Assessment: `batchId/programmeId` (R), `name` (R), `maxScore` (R int > 0), `passScore` (R ≤ maxScore), `heldAt` (R). Score: `score` (R 0–maxScore), `result` (`pass|fail`, computed server-side), `enteredBy/enteredAt` (R).

## 13. `certificates/{id}` — Doc ID = certificate number `TNXC-YYYY-NNNNN`

| Field | Type | Req | Validation |
|---|---|---|---|
| participantId / enrolmentId / programmeId / batchId | string | R | consistent chain, immutable |
| issuedAt | ts | R | — |
| issuedBy | string | R | `"system"` or uid (audited exception path) |
| criteria | map | R | BR-03 evidence snapshot `{attendancePct, minRequired, assessmentPassed}` recomputed at issuance (C-2) |
| status | string | R | `issued\|revoked` |
| revokedReason | string\|null | O | required when revoked; revocation audited `override` |
| verifyHash | string | R | random 32-hex; public verification lookup, no PII |

## 14. `careerProfiles/{participantId}` — 1:1 with participant

`interest` (map R: `{jobCategories[], preferredCountries[], passportStatus: none|applied|held, willingToRelocate: bool}`), `readinessScore` (0–100|null), `eligibility` (R `not_evaluated|not_eligible|eligible` — **default not_evaluated, never auto-set**, BR-09), `eligibilityNote/evaluatedBy/evaluatedAt` (O, required together when eligibility ≠ not_evaluated), `resumeStatus` (`none|draft|reviewed|final`). Subcollection **`guidanceSessions/{id}`**: `heldAt`, `officerUid`, `notes`, `actions[]`.

## 15. `employers/{id}`

`name` (R, unique-ish check on create), `country` (R), `industry` (O), `contact` (map: name/phone/email), `agreementNote` (O), `status` (`active|archived`).

## 16. `placements/{id}`

`participantId` (R, careerProfile must be `eligible` — BR-09 gate), `employerId` (R), `jobCategory/country` (R), `status` (R `under_review|shortlisted|interview|offer|placed|dropped`), `statusHistory[]` (`{status, at, byUid, note}`, append via server action, bounded), `feeDisclosure` (R map: `{terranextFeePaise: literal 0 (BR-08, rules-enforced), thirdPartyNotes}`). Index: (status, updatedAt desc).

## 17. `alumniRecords/{participantId}`

`memberSince` (ts R), `triggeredByCertificateId` (string R — or audited override), `engagement` (`{referrals int, eventsAttended int}`), `consentForSuccessStory` (bool R, default false — gates website Success Stories per Phase 04). Created by trigger (BR-05).

## 18. `feeAccounts/{enrolmentId}` + `payments/{id}` (sub)

Account: `participantId/programmeId` (R), `plan` (map R: `{totalPaise, discountPaise (audited approval when > 0), discountApprovedBy|null, installments[]: {label, amountPaise, dueDate, status: pending|paid|overdue}}` — sum(installments) == total − discount), `paidPaise/balancePaise` (R, transaction-maintained, int ≥ 0), `nextDueDate` (ts|null, denorm for pending-fee index). Payment (append-only, ADR-012): `amountPaise` (R int > 0), `method` (`cash|upi|bank|gateway`), `receivedAt/receivedBy` (R), `receiptNo` (R from counter), `note` (O). Corrections = reversing entries.

## 19. `communications/{id}`

`channel` (`email|sms|whatsapp`), `direction` (`outbound|inbound`), `refType` (`lead|participant`) + `refId` (R), `templateKey` (string|null), `subject` (O), `bodyPreview` (R ≤ 300 — full body not stored; provider is system of record), `status` (`queued|sent|failed`), `sentAt` (ts|null), `byUid` (R uid|`"system"`). FR-10.3: send path creates this doc first. Index: (refType, refId, sentAt desc).

## 20a. Growth Partner Management (GPMS, Doc 25/ADR-014)

**`growthPartners/{partnerId}`** — external referral-partner identity. Writes: server actions only (`registerGrowthPartner`, `decideGrowthPartner`, `setGrowthPartnerStatus`, `updateOwnProfile`).

| Field | Type | Req | Validation | Example |
|---|---|---|---|---|
| displayName | string | R | 2–120 chars | `"Priya Retail Partners"` |
| email | string | R | email | `"priya@partner.example"` |
| phone | string | R | E.164 | `"+919876543210"` |
| organizationName | string\|null | O | ≤ 160 | — |
| applicationNotes | string\|null | O | ≤ 1000; free text from public registration, null for staff-entered partners (2026-07-26 addition) | — |
| status | string | R | `pending_approval\|active\|suspended\|rejected` | `"active"` |
| leadershipLevel | string | R | `bronze\|silver\|gold\|platinum` | `"bronze"` |
| authUid | string\|null | O | set once approved | — |
| approvedAt / approvedBy | ts\|null / string\|null | O | set together | — |

Indexes: (deletedAt, createdAt desc) — directory; (email, deletedAt) — registration dedupe; (authUid, deletedAt) — session→partner lookup.

**`rewardRules/{ruleId}`** — configurable reward computation (never hardcoded). `programmeId` (R, string or literal `"ALL"`), `kind` (R `flat|percent`), `amountPaise` (int > 0, required when `kind=flat`), `percentBps` (1–10000, required when `kind=percent`), `active` (R bool), `effectiveFrom` (ts R). Index: (programmeId, active).

**`rewardLedger/{ledgerId}`** — one immutable entry per reward event (append-only). `partnerId/leadId/participantId/feeAccountId/paymentId/ruleId` (R, string), `amountPaise` (R int > 0), `status` (R `accrued|paid`). Indexes: (partnerId, createdAt desc), (partnerId, status).

**`wallets/{partnerId}`** — doc ID = partner ID. `balancePaise` (R int ≥ 0, transaction-maintained only — never a bare counter write). Subcollection **`transactions/{txId}`**: `kind` (R `credit|debit`), `amountPaise` (R int > 0), `reason` (R string), `refLedgerId` \| `refPayoutId` (O, exactly one set).

**`payoutRequests/{payoutId}`** — `partnerId` (R), `amountPaise` (R int > 0), `status` (R `requested|approved|rejected|processing|paid`), `requestedAt` (ts R), `decidedBy`/`decidedAt` (O, set together on decision).

**`partnerNotifications/{partnerId}/items/{id}`** — same shape as an in-app staff notification, scoped per partner; partner-readable only for their own `partnerId`.

**Extended fields** (additive, no shape break): `leads/{id}` gains `partnerId: string|null`, `partnerName: string|null` (mirrors `assignedToUid`/`assignedToName`, §8); `participants/{id}` gains `partnerId: string|null`, propagated from the originating lead at conversion (§11).

## 20. Future-Reserved (fields exist, features don't)

`family.familyRecordId` (family entity), `branchId` everywhere (branch UI), `portalAccounts` collection (portal identity mapping — not created until portals), `stats/{period}` aggregates (created with dashboards, M-milestone per roadmap Doc 22).
