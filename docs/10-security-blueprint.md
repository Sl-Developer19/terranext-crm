# 10 — Security Blueprint

**TerraNext Business OS · Architecture Blueprint**
Sources: BRD Section 22 NFRs · SOP Ch.17 (classification, incident mgmt, registers) · BR-06

---

## 1. Authentication Flow

```
Login (email/password) ──▶ Firebase Auth ──▶ ID token (claims: role, branchId)
      │                                            │
      │                        POST /api/session ──▶ verify token (Admin SDK)
      │                                            └─ set __session cookie
      ▼                                               (HttpOnly, Secure,
middleware verifies session cookie per request         SameSite=Lax, 5-day expiry,
└─ invalid/expired → /login                            Firebase session cookie)
```

- Staff accounts **admin-provisioned only**; no self-signup path exists in the app or in Auth settings (email/password provider with signup blocked server-side; provisioning via `provisionUser` callable).
- First login forces password change (`users.mustChangePassword`); password policy via Firebase Auth policy (min 10, mixed).
- MFA: TOTP enrollment offered to all staff at launch; **enforced** for `system_admin`, `founder`, `finance` (Highly Confidential data access, SOP 17.6).
- Logout revokes refresh tokens (`revokeRefreshTokens`) + clears cookie. Disable user → status flip + token revocation → locked out within one request (middleware status check).
- Login success/failure and logout are audited (`action: 'login'`), feeding the System Access Log register (SOP 17.16).

## 2. Authorization Flow

Request path for every mutation (fixed order, Doc 08 §5):

```
Zod validate → requirePermission(claims, 'module:action', scope)
→ business precondition (logic.ts: BR-xx) → transactional write + audit (withAudit)
```

- Claims are the single identity payload; the server never trusts client-sent role/uid fields.
- Row-level scopes: trainer↔batch (`batches.trainerUid`), consultant↔assigned leads (`assignedToUid`) — checked in rules via `get()` and in actions via loaded docs, not client assertions.
- Field-level visibility (Finance sees fee fields, Placement sees career fields on participants) is enforced server-side by **projection in server components** and in rules for writes; the participant document read is role-shaped before it reaches the client.

## 3. Firestore Security Rules Strategy

- **Default deny.** Root match denies; every collection has an explicit block.
- Shared predicates library at top of `firestore.rules`: `isStaff()`, `hasRole(r)`, `can(module, action)` (mirrors the static permission map — regenerated from `lib/rbac/permissions.ts` by a codegen script so code and rules cannot drift), `isNotDeleted()`, `unchanged(field)`.
- Write validation per collection: required fields present, enums within literal sets, envelope fields correct (`createdBy == request.auth.uid`, timestamps `== request.time`), immutable fields protected (`unchanged('participantId')`, `unchanged('leadId')`), `terranextFeePaise == 0` on placements (BR-08).
- **Client writes are the exception, not the rule.** Privileged flows (provisioning, lead conversion, ID/certificate issuance, payments, claims) go through Functions/server actions with the Admin SDK; rules for those collections allow client **reads only**.
- `auditLogs`: `create` only, and only as part of a batch whose companion write the actor could perform; `update`/`delete`: `if false` for everyone.
- `delete: if false` globally (soft delete only, Doc 03 §5).
- Rules are tested in the emulator (allow + deny cases per role per collection) — a rules change without tests fails review (Doc 09).

## 4. Storage Rules Strategy

Bucket layout: `participants/{participantId}/{docId}` · `users/{uid}/avatar` · `certificates/{certId}.pdf` · `cms/` (website assets, out of CRM scope).

- Default deny. Reads of participant documents: staff with `participants:view` (via custom-claims check); certificate PDFs served through a Function endpoint (verification flow), not public bucket reads.
- Writes: only via the upload flow (§6) — rules require `request.resource.size < 10MB`, contentType allow-list (`image/*`, `application/pdf`), path matches the metadata doc being created.
- No public bucket ACLs anywhere; signed URLs (15-min) for downloads.

## 5. Threat Model (STRIDE-lite, top risks)

| Threat | Vector | Mitigation |
|---|---|---|
| Spoofing | stolen staff credentials | MFA (enforced for high-privilege), token revocation on disable, login audit + anomaly review |
| Tampering | client altering business fields (fees=0? attendance %, capacity) | Admin-SDK-only privileged writes; rules field validation; server recomputation of roll-ups |
| Repudiation | "I didn't change that record" | BR-06 immutable audit with actor + diff; batch-coupled audit writes |
| Info disclosure | over-broad reads (trainer reading finance), public lead form scraping data | role-shaped projections, rules read predicates, website has zero Firestore access |
| DoS/abuse | `createLead` endpoint spam | App Check on website + CRM, rate limit per IP/phone in the Function, CAPTCHA-free honeypot field first (escalate if abused) |
| Elevation | user editing own `users` doc / claims | `users` writes Function-only; claims set only by `setUserRole` (system_admin, audited) |
| Injection | unvalidated strings into templates/exports | Zod everywhere; CSV export cell-escaping; no HTML rendering of user content |

Secrets: no service-account keys in the repo; Functions use ADC; client env vars are public config only (`NEXT_PUBLIC_` Firebase config is not a secret); `.env` gitignored with `.env.example` documented.

## 6. Secure File Upload Flow

```
1. Client requests upload ticket (server action): validates kind, size, contentType, permission
2. Action creates participants/{id}/documents/{docId} metadata doc (status: 'pending')
   and returns a short-lived signed upload URL for the exact storage path
3. Client PUTs file to signed URL (Storage rules re-check size/type)
4. Storage finalize trigger: verifies metadata match, sets status: 'ready'
   (mismatch → deletes object, marks 'rejected', audits)
5. Downloads only via 15-min signed URLs issued after a permission check; issuance audited
```

No direct client SDK uploads to arbitrary paths; the metadata doc is the authorization anchor.

## 7. Audit Flow

- What: every create/update/soft-delete/status/permission change on business data; logins; exports; overrides (schema in Doc 03 §6).
- How: `withAudit()` batches business write + audit doc atomically (client-permitted writes); Admin SDK writes audit in the same transaction (privileged writes). **An unaudited write path is a build error in review**, not a runtime hope.
- Reads: `system_admin` and `founder` only; the Audit Logs screen provides the SOP 17.16 registers as filtered views (Access Authorisation, System Access, Incident, Disposal).
- Incident response: SOP 17.14 workflow (Identify → Contain → Report to Ops Manager/Founder → Investigate → Correct → Document) gets a runbook page in `docs/` at go-live; audit trail is the investigation substrate.
- Consent: registration consent (text version + timestamp) stored on the lead (Doc 03) — data-protection posture depends on it.
