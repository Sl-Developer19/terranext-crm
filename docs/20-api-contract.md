# 20 — API Contract

**TerraNext Business OS · Architecture Hardening**
Service contracts for every privileged operation (inventory: Doc 19). Firebase callables/server actions today; the same contracts become versioned REST endpoints when external consumers exist (§4). Zod schemas here are authoritative — implementation imports them, never re-declares.

## 1. Envelope & Error Model (all services)

```ts
// Success / failure envelope — no service throws across the boundary
type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string;      // safe for UI
        fields?: Record<string, string>;      // code=validation
        rule?: 'BR-01'|'BR-02'|'BR-03'|'BR-04'|'BR-09';  // code=precondition
        retryable: boolean } };

type AppErrorCode = 'validation'|'unauthenticated'|'permission'|'not_found'|'conflict'
                  | 'precondition'|'rate_limited'|'unavailable'|'internal';
// ADR-013 additions: unauthenticated→401 (generic credential failure),
// rate_limited→429 (lockout / rate limits; retryable, Retry-After header when known)
```

Auth context is never part of the input schema — identity comes from the session/token; any client-supplied actor field is rejected by schema (`.strict()` everywhere).

## 2. Contracts — Public Surface

### `createLead` (HTTPS POST `/createLead`) — the website↔CRM interface (BR-07)

```ts
Input = z.object({
  formType: z.enum(['general','genz','family','parent_session','trade_career','workshop','campus_leader']),
  name: z.string().min(2).max(80),
  phone: z.string().regex(E164),
  email: z.string().email().nullable().default(null),
  programmeInterestSlug: z.string().nullable().default(null),
  message: z.string().max(1000).optional(),
  utm: z.object({ source: z.string(), medium: z.string(), campaign: z.string() }).partial().optional(),
  consent: z.object({ given: z.literal(true), textVersion: z.string() }),   // hard requirement
  hp_field: z.string().max(0).optional(),   // honeypot — non-empty ⇒ silently dropped
}).strict();
Output = { leadId: string; dedup: boolean };   // dedup=true ⇒ existing lead updated (activities entry)
Errors: validation only. Rate limit: 5/phone/day, 20/IP/hour → 429 (retryable:false).
```
Contract stability note: the website deploys independently (ADR-002) — **breaking changes to this schema require a versioned path (`/v2/createLead`) and a coordinated website release.**

### `verifyCertificate` (HTTPS GET) — `{no, hash}` → `{ valid: boolean; programmeName?: string; issuedAt?: string }`. Invalid/revoked/missing are indistinguishable in output (no oracle).

## 2b. Contracts — Authentication (route handlers, ADR-013)

### `login` (HTTPS POST `/api/auth/login`) — the official authentication entry point

```ts
Input  = loginSchema;   // { email: string (trimmed, email), password: string (min 1) } — features/auth/schema.ts
Output = { status: 'authenticated' }                       // + Set-Cookie __session (HttpOnly)
       // 'mfa_required' remains a typed CredentialVerdict but no challenge
       // flow is wired — MFA withdrawn by owner decision 2026-07-21 (Doc 10 §1)
Errors: validation (422, malformed body)
      · unauthenticated (401, always "Invalid email or password." — unknown email,
        wrong password, disabled and unprovisioned accounts are indistinguishable)
      · rate_limited (429, "Too many failed login attempts. Try again in X seconds.",
        Retry-After header; lockout tiers per config/auth-security.ts)
      · unavailable (503, upstream/provider failure — no counter change).
Side effects: loginSecurity transaction, loginAttempts register entry (every attempt),
securityEvents on the 10th consecutive failure, auditLogs 'login' + users.lastLoginAt on success.
```

### `logout` (HTTPS DELETE `/api/session`) — revokes refresh tokens, clears cookie, audits sign-out. (Future: moves to `/api/auth/logout` alongside `/api/auth/refresh`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`.)

## 3. Contracts — Staff Surface (callables & server actions; permission per Doc 19)

```ts
// User management
provisionUser:   { email, displayName, phone, role: RoleKey, assignedBatchIds?: string[] } → { uid }
setUserRole:     { uid, role: RoleKey, assignedBatchIds?: string[] } → { ok: true }     // precondition: last-admin guard
setUserStatus:   { uid, status: 'active'|'disabled' } → { ok: true }                    // precondition: not self

// Admission core
convertLead: {
  leadId, programmeId, batchId,
  feePlan: { totalPaise: Int, discountPaise: Int0, installments: InstallmentInput[] },
  linkExistingParticipantId?: string   // BR-01 duplicate-resolution path
} → { participantId, enrolmentId, feeAccountId }
// Errors: precondition(BR-02) — no recommended counselling
//         conflict{ matches: DuplicateMatch[] } — BR-01 candidates when link id absent
//         conflict(BR-04) — capacity lost in race

allocateBatch:   { participantId, enrolmentId, batchId } → { ok } // conflict(BR-04)

// Certification
issueCertificate:{ enrolmentId } → { certificateId, criteria: EvidenceSnapshot }
// precondition(BR-03) → { rule:'BR-03', detail: { attendancePct, required, assessmentPassed } }
revokeCertificate:{ certificateId, reason: z.string().min(10) } → { ok }

// Career & placement
evaluateEligibility: { participantId, eligibility: 'eligible'|'not_eligible', note: z.string().min(10) } → { ok }
createPlacement:     { participantId, employerId, jobCategory, country } → { placementId }  // precondition(BR-09)
advancePlacement:    { placementId, status: PlacementStage, note? } → { ok }  // valid-transition check

// Finance
recordPayment: { feeAccountId, amountPaise: IntPositive, method, note? } → { paymentId, receiptNo, newBalancePaise }
applyDiscount: { feeAccountId, discountPaise: IntPositive, reason: z.string().min(10) } → { ok }  // permission: approver

// Communications & files
sendCommunication:  { refType: 'lead'|'participant', refId, channel, templateKey, variables: Record<string,string> } → { communicationId }
requestUploadTicket:{ participantId, kind: DocKind, fileName, sizeBytes: max 10MB, contentType: allowList } → { docId, uploadUrl, expiresAt }
issueDownloadUrl:   { participantId, docId } → { url, expiresAt }   // 15-min
```

Validation is layered identically everywhere: schema (`validation`) → permission (`permission`) → business rule (`precondition` with `rule` id) → transactional integrity (`conflict`). UI copy maps codes per Doc 08 §6.

## 4. Future REST Compatibility

When external consumers arrive (employer portal API, integrations — Doc 12 §5):

- Callables/actions are thin shells over `features/*/logic.ts` + repository calls — the REST layer (`/api/v1/*` route handlers) wraps **the same functions** with bearer-token auth (Firebase ID tokens or API keys for partners) and the same `ServiceResult` JSON envelope.
- Error envelope maps to HTTP: `validation` 422 · `permission` 403 · `not_found` 404 · `conflict` 409 · `precondition` 412 · `unavailable` 503 · `internal` 500.
- Versioning: URL-versioned (`/v1/`); schemas already carry `.strict()` so additive fields are the only non-breaking change class — matching Firestore `schemaVersion` discipline.
- Webhooks (payment gateway inbound): signature-verified endpoints under `functions/http`, writing through the same audited actions (`recordPayment` with actor `system:gateway`).
