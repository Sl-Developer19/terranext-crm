# 27 — Security Review: Public Endpoints

**TerraNext Business OS · Go-Live (Doc 22 M8, Doc 10 §5)**
Status: **Reviewed 2026-07-26 (static code review of the deployed route handlers). Not a substitute for a penetration test** — no live traffic, fuzzing, or external scanning was performed against a running environment. Scope: every route under `src/app/api/**` reachable without a valid staff or partner session, i.e. the actual internet-facing attack surface of this application.

---

## 1. Endpoint Inventory & Posture

| Endpoint | Method | Auth | Origin restriction | Rate limit | Enumeration-safe | Notes |
|---|---|---|---|---|---|---|
| `/api/createLead` | POST | none (public intake, Doc 20 §2) | origin allow-list (`PUBLIC_INTAKE.allowedOrigins`) | 5/phone/day, 20/IP/hour (Firestore fixed-window) | n/a (no accounts to enumerate) | honeypot field; `.strict()` Zod schema |
| `/api/registerGrowthPartner` | POST | none (public intake, Doc 25 §4) | same origin allow-list as `createLead` | same rate-limit mechanism | partial — see §2.1 | honeypot; mirrors `createLead` posture |
| `/api/certificates/verify` | GET | none (public by design, Doc 19) | none | **none** — see §2.2 | yes (identical shape for invalid/revoked/missing) | no PII in response; short cache (60s) |
| `/api/auth/login` | POST | none (pre-session) | none (not origin-restricted — same-site form, no cross-origin caller expected) | yes — lockout tiers (ADR-013) | yes (generic "Invalid email or password" for unknown/wrong/disabled/unprovisioned) | `loginAttempts`/`securityEvents` register every attempt |
| `/api/auth/partner-login` | POST | none | none | yes — reuses `performLogin` (same lockout tiers) | yes (same generic message) | separate `__partner_session` cookie |
| `/api/auth/forgot-password` | POST | none | none | **none** — see §2.3 | yes (always generic success response) | |
| `/api/auth/reset-password` | POST | none (oobCode is the proof) | none | **none** — see §2.3 | n/a | oobCode verified against Identity Toolkit |
| `/api/auth/reauth` | POST | **requires valid `__session`** | n/a | inherits login rate limiting indirectly (same `performReauth`/lockout path) | n/a | not part of the unauthenticated attack surface — included for completeness |
| `/api/errors/report` | POST | none (deliberately, Doc 23 §3) | none | **none** — see §2.4 | n/a | schema length-caps every field |
| `/api/jobs/daily`, `/api/jobs/dispatch-communications` | POST | bearer `JOBS_SECRET`, constant-time compare, fail-closed if unset | n/a (Scheduler-only) | n/a (authenticated) | n/a | ✅ no findings |
| `/api/session` (DELETE), `/api/partner-session` (DELETE) | DELETE | requires the cookie to have any effect; a caller with no cookie just gets a no-op success | n/a | n/a | n/a | logout only, no state-changing effect without a valid cookie |

## 2. Findings

### 2.1 `registerGrowthPartner` — email-enumeration surface (Low)

The action returns `conflict` when an email is already registered (per Doc 20's new contract entry). Combined with no per-caller identity requirement, a scripted caller can probe arbitrary emails and learn which are already-registered partners. `createLead` avoids this class of problem entirely (dedupe merges silently into an activity, never surfacing "already exists" to the caller) — `registerGrowthPartner` diverges because a partner *account* is a stronger identity than a lead. **Recommendation:** keep the current behavior (a partner needs to know their own registration failed to retry correctly) but confirm the rate limit (shared with `createLead`'s 20/IP/hour) is tight enough that this isn't a practical bulk-enumeration channel; do not loosen it further.

### 2.2 `certificates/verify` — no rate limit (Medium) — **Fixed 2026-07-26**

Was flagged in the route's own code comment as deferred to go-live hardening — this review is that hardening pass. Unlike `createLead`/`registerGrowthPartner`, this endpoint had **zero** request throttling. Because the response is enumeration-safe (invalid/revoked/missing all look identical) the practical risk was not certificate-number discovery but **cost/availability**. **Resolution:** added `consumeRateLimit` (60/IP/hour) to `src/app/api/certificates/verify/route.ts`, same mechanism already used for public intake.

### 2.3 `forgot-password` / `reset-password` — no per-IP rate limit (Medium) — **Fixed 2026-07-26**

**Correction found during review:** `forgot-password` already had a per-**email** cooldown (`reset-request-throttle.ts`, 60s, silent — covered by its own 4-test suite) that stops one inbox being mail-bombed. That is a different axis from what was missing: nothing throttled a single **caller** cycling through many different target addresses, nor throttled `reset-password`'s confirm step at all. Both endpoints were also enumeration-safe at the response-shape level already (forgot-password always returns generic success; reset-password's failure is oobCode validity, not account existence). **Resolution:** added per-IP `consumeRateLimit` to both routes — 5/IP/hour on `forgot-password` (on top of, not replacing, the existing per-email cooldown), 10/IP/hour on `reset-password` (lighter, since oobCodes are single-use, short-lived, high-entropy tokens and this limit is a backstop, not the primary defence).

### 2.4 `errors/report` — no rate limit, no origin check (Low) — **Fixed 2026-07-26**

Deliberately unauthenticated (an error can occur before login) and deliberately schema-capped, but nothing stopped a scripted caller from POSTing a high volume of fabricated error reports, costing Cloud Error Reporting API calls and polluting the signal the on-call engineer relies on (Doc 24 §6.2). **Resolution:** added `consumeRateLimit` (30/IP/hour); over-limit requests are silently dropped with a `200 {status: 'dropped'}` rather than surfaced as an error, since this is telemetry, not a user-facing action.

### 2.5 `safeKey` hash in the rate limiter — non-cryptographic (Informational, no action required)

`src/lib/rate-limit/fixed-window.ts`'s `safeKey` uses a 32-bit rolling hash, not a cryptographic hash, to turn a phone/IP into a Firestore doc ID. This is fine for its actual purpose (avoid plaintext PII as a doc ID) — it is not used as a secret or an access-control boundary — but two different identifiers could theoretically collide into the same bucket, causing one caller to be throttled by another's volume. Given the limiter already fails open on Firestore errors (a deliberate, documented BR-07 tradeoff) and a false-positive throttle here only ever affects the same low-stakes public-intake path, this is not a finding requiring a fix, just a documented characteristic for whoever tunes these limits later.

## 3. What Already Meets the Bar (no action needed)

- Bearer-secret job endpoints: constant-time comparison, fail-closed when unset, correctly out of scope for public-facing concerns since Scheduler is the only caller.
- Login/partner-login: real lockout tiers, generic messaging, full access-log register (`loginAttempts`, `securityEvents`) — this is a mature, already-hardened surface (Doc 24 §6a's separate rules-emulator verification covers the Firestore side of this).
- `createLead`/`registerGrowthPartner`: origin allow-list + honeypot + rate limit + strict schema is the right shape for public intake; no changes recommended beyond §2.1's note.
- Security response headers (CSP, HSTS, X-Frame-Options, Permissions-Policy, COOP) are set globally in `next.config.mjs` for every route, public or not.
- App Check is a one-time project-config step (Doc 24 §3.2), not code — confirm it is actually enforced on Firestore before go-live; this review cannot verify a project-console setting from source alone.

## 4. Action Items Before Go-Live

| # | Item | Severity | Owner | Status |
|---|---|---|---|---|
| 1 | Add `consumeRateLimit` to `certificates/verify` (§2.2) | Medium | Engineering | **Done** 2026-07-26 |
| 2 | Add `consumeRateLimit` to `forgot-password` and `reset-password` (§2.3) | Medium | Engineering | **Done** 2026-07-26 |
| 3 | Add `consumeRateLimit` to `errors/report` (§2.4) | Low | Engineering | **Done** 2026-07-26 |
| 4 | Confirm App Check is enforced on Firestore in the production project console (Doc 24 §3.2) — cannot be verified from source | Medium | Ops/Founder | Open |
| 5 | Confirm `PUBLIC_INTAKE_ORIGINS` in production matches the live website domain exactly (already a Doc 24 §7 checklist item) | Medium | Ops | Open |
| 6 | Add unit/integration test coverage asserting each new rate limit actually rejects the (limit+1)th request within the window | Medium | Engineering | Open |

## Sign-off

- [ ] Item 6 (test coverage for items 1–3) complete
- [ ] Items 4–5 confirmed in the production console
- [ ] Reviewer: _______________________  Date: _______________
