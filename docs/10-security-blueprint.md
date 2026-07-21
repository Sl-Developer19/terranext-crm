# 10 — Security Blueprint

**TerraNext Business OS · Architecture Blueprint**
Sources: BRD Section 22 NFRs · SOP Ch.17 (classification, incident mgmt, registers) · BR-06

---

## 1. Authentication Flow

> **Amended by ADR-013** (approved 2026-07-20): the password stage runs **server-side** so the brute-force lockout policy governs every attempt. The former client-SDK sign-in + `POST /api/session` mint is superseded; `/api/session` retains only DELETE (sign-out).

```
POST /api/auth/login {email, password}          server-side, single endpoint
  1. guards[] (extension slot: App Check, CAPTCHA, per-IP rate limit)
  2. isLoginLocked(sha256(email))? ──▶ 429 "Too many failed login attempts.
  │                                        Try again in X seconds." (+Retry-After)
  3. Identity Toolkit REST signInWithPassword (server↔Google; key is public config)
  │     failure ──▶ incrementFailedLogin() ──▶ 401 generic "Invalid email or password."
  │                  (3 fails→30s · 5→5min · 10→30min + HIGH securityEvent; A1 decay 30min)
  │     mfa_required ──▶ challenge outcome (flow attaches when MFA ships; no counter change)
  4. staff profile check (users doc: provisioned + active) — else generic 401
  5. resetFailedLogin() · loginAttempts entry · auditLogs 'login' · users.lastLoginAt
  6. mint Firebase session cookie ──▶ Set-Cookie __session (HttpOnly, Secure,
                                       SameSite=Lax, 5-day expiry)
middleware verifies session cookie per request └─ invalid/expired → /login
```

- **Every attempt** (success, failure, locked, disabled) writes a `loginAttempts` register entry: timestamp, email, outcome, IP (normalized v4/v6), userAgent, reason (SOP 17.16).
- Responses never distinguish unknown email / wrong password / disabled account — one generic message, one shape (enumeration resistance). Lockout state is keyed by `sha256(normalized email)` and tracked for unknown addresses too.
- Lockout is server-enforced; any client countdown is cosmetic. Policy numbers live in `config/auth-security.ts` only.

- Staff accounts **admin-provisioned only**; no self-signup path exists in the app or in Auth settings (email/password provider with signup blocked server-side; provisioning via `provisionUser` callable).
- First login forces password change (`users.mustChangePassword`); password policy via Firebase Auth policy (min 10, mixed).
- MFA: TOTP enrollment offered to all staff at launch; **enforced** for `system_admin`, `founder`, `finance` (Highly Confidential data access, SOP 17.6).
- Logout revokes refresh tokens (`revokeRefreshTokens`) + clears cookie. Disable user → status flip + token revocation → locked out within one request (middleware status check).
- Login success/failure and logout are audited (`action: 'login'` on success/logout, plus the per-attempt `loginAttempts` register), feeding the System Access Log register (SOP 17.16).

### 1a. Idle-Timeout Re-Auth (M1-B)

- Applies only to the MFA-enforced roles (`system_admin`, `founder`, `finance` — `config/auth-security.ts` `MFA_REQUIRED_ROLES`, one shared definition of "high-privilege" for both MFA and idle enforcement).
- Client tracks activity (`mousemove`/`keydown`/`scroll`/`click`/`touchstart`) via a Zustand store (`stores/idle-store.ts`); 15 minutes idle with no activity triggers a full-screen lock modal, with a 60-second warning toast beforehand (`config/idle-security.ts`).
- The lock is **client-side UI state only** — the `__session` cookie and its 5-day expiry are untouched. `POST /api/auth/reauth` re-verifies the password against Identity Toolkit for the *current session's own account* (never a client-submitted email/uid), reusing the same brute-force lockout tiers as `/api/auth/login` (§1) — the lock screen cannot be brute-forced on a separate counter.
- MFA is not re-challenged on every idle cycle (approved scope) — password-only re-auth, consistent with treating idle-lock as a presence check rather than a fresh sign-in.
- Success is audited (`action: 'login'`, `context.reason: 'idle_reauth'`); failures follow the same generic, enumeration-resistant message as login.

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

**As built (Participant Management, 2026-07-21).** Steps 1–5 are implemented as server actions in `features/participants/actions/manage-documents.ts`:

| Step | Implementation |
|---|---|
| ticket | `requestUploadTicket` — permission check → server-generated `documentId` → `pending` metadata doc → v4 signed PUT URL (15 min) bound to one path **and** content type |
| upload | client `PUT`s to the signed URL with exactly the signed `Content-Type` (the signature covers the header) |
| verify | `confirmDocumentUpload` — object existence + size + contentType must match the metadata doc, else the object is deleted and the record marked `rejected`. This is the server-action equivalent of Doc 19's `onUploadFinalize` trigger; the trigger can replace it later without changing the client contract |
| download | `issueDocumentDownloadUrl` — 15-min signed GET, **audited as `export`** (RR-09 insider-exfiltration control) |

`storage.rules` stays fully default-deny: signed URLs are authorized by their signature, not by rules, so there is no SDK path to an arbitrary object.

> **Deployment prerequisite.** `getSignedUrl` signs with the service-account private key locally. On App Hosting (ADC, no local key file) the runtime service account needs `roles/iam.serviceAccountTokenCreator` **on itself** so it can call `signBlob`; without that grant, uploads and downloads fail at signing time. One-time IAM grant, alongside the Doc 19 §4a export-bucket setup.

## 7. Audit Flow

- What: every create/update/soft-delete/status/permission change on business data; logins; exports; overrides (schema in Doc 03 §6).
- How: `withAudit()` batches business write + audit doc atomically (client-permitted writes); Admin SDK writes audit in the same transaction (privileged writes). **An unaudited write path is a build error in review**, not a runtime hope.
- Reads: `system_admin` and `founder` only; the Audit Logs screen provides the SOP 17.16 registers as filtered views (Access Authorisation, System Access, Incident, Disposal).
- Incident response: SOP 17.14 workflow (Identify → Contain → Report to Ops Manager/Founder → Investigate → Correct → Document) gets a runbook page in `docs/` at go-live; audit trail is the investigation substrate.
- Consent: registration consent (text version + timestamp) stored on the lead (Doc 03) — data-protection posture depends on it.

## 8. Observability (M1-E, Doc 23 §3 binding amendment)

Audit logs answer "what happened to business data"; error reporting answers "what broke" — the two are deliberately separate (an error report is never a business mutation and carries no audit entry).

- **Client:** `ErrorReportingProvider` (root layout) catches uncaught `window` errors and unhandled promise rejections; `app/error.tsx` / `app/global-error.tsx` catch React render errors. All three POST to `/api/errors/report` (unauthenticated by necessity — an error can occur before/without a session; `client-error-schema.ts` length-caps every field against payload abuse).
- **Server:** `src/instrumentation.ts` `onRequestError` reports SSR/route-handler/server-action errors automatically. It is Node-runtime-only (`register()` gated on `NEXT_RUNTIME === 'nodejs'`) — middleware errors (Edge-only) are not covered, an accepted gap since `middleware.ts` does nothing beyond cookie verification.
- **Functions:** `reportFunctionError` wraps caught failures in scheduled/trigger code so the dead-letter pattern (Doc 19 §5, RR-16) doesn't also make the failure invisible to Error Reporting.
- **Backups:** Firestore PITR (continuous, 7-day) + `scheduledFirestoreExport` (weekly, Doc 19 §4) — manual one-time GCP setup in Doc 19 §4a (PITR enablement is a billing decision, not something CI/Functions enable silently).
