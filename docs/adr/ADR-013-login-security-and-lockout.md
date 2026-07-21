# ADR-013 — Server-Side Login with Brute-Force Lockout

Status: **Accepted** · Date: 2026-07-20 · Amends: Doc 10 §1 (authentication flow)

## Context
The original Doc 10 §1 flow signed in with the Firebase client SDK and exchanged the ID token for a session cookie. That leaves the server blind to failed attempts: Firebase's own throttling is opaque, per-device, tunable by no one, and writes nothing to the SOP 17.16 System Access Log register. An internet-facing staff CRM holding Confidential-class data needs an attempt ledger, an escalating lockout policy under our control, and enumeration-resistant responses.

## Decision
Authentication moves entirely server-side behind `POST /api/auth/login`:

1. **Credential verification via the Identity Toolkit REST API** on the server (`IdentityToolkitVerifier`) — every attempt, success or failure, passes through our code. Firebase's upstream throttle stays enabled as defense in depth.
2. **Escalating lockout ledger** in server-only Firestore collections, keyed by `sha256(normalized email)` so the ledger stores no plain addresses and unknown emails receive identical treatment: `loginSecurity/{emailHash}` (counters/lock state), `loginAttempts` (access-log register), `securityEvents` (high-signal incidents). All three are Admin-SDK-only with explicit deny-all rules blocks (Doc 18).
3. **Policy tiers** (config in `config/auth-security.ts`): 3 fails → 30s lock · 5 → 5min · 10 → 30min + `LOGIN_LOCKOUT` security event.
4. **Approved amendments** (design-review decisions binding on implementation):
   - **A1** — "consecutive" failures decay: a failure older than 30min restarts the streak at 1.
   - **A2** — a tier's security event fires exactly once, at crossing; failures beyond the top tier extend its lock from the newest failure without re-firing events.
   - **A3** — one generic failure message; unknown email, wrong password, disabled account, and unprovisioned account are indistinguishable in response shape, timing class, and copy.
   - **A5** — all time flows through an injected `Clock`; `Date.now()` has one sanctioned call site.
   - **A7** — `SecurityEventType` is an extensible catalogue; members are added, never repurposed.
5. **Orchestration is dependency-injected** (`performLogin(deps, input)`): guards[] (future App Check/CAPTCHA), verifier (future SSO), session minter, staff directory, audit writer — each swappable without touching the flow. The route handler is a thin HTTP mapping.

## Alternatives Considered
1. **Keep client-SDK sign-in + server cookie mint** (the original design) — rejected: failures never reach our server, so no ledger, no lockout policy, no access-log register; enumeration behavior owned by Firebase, not us.
2. **Identity Platform blocking functions** — native hook into auth events; rejected: requires the paid Identity Platform tier and still doesn't give attempt-ledger control at our granularity.
3. **Per-IP rate limiting only** — rejected as primary: campus/office NAT makes IP a poor key (one angry classroom locks out the office); email-keyed with IP *recorded* is the chosen shape, and per-IP guards remain a `LoginGuard` slot.

## Pros
Server-enforced policy with SOP-ready registers; enumeration resistance by construction; deterministic, fully unit-tested policy (pure functions + injected clock); PII-free security ledger; extension points for MFA challenge, SSO, App Check, CAPTCHA.

## Cons / Accepted Costs
- Login latency adds one REST round-trip plus 2–3 Firestore writes per attempt — acceptable for an interactive login.
- The browser Firebase SDK is **never signed in**: all Firestore access currently flows through server components/actions. When client-direct SDK reads land (offline attendance marking, realtime widgets — Doc 11 §1), the login response must additionally mint a **custom token** for `signInWithCustomToken`. This is a known, planned follow-up, not an oversight.
- `loginAttempts` grows unbounded pending the retention policy (same open question as auditLogs, Doc 03 §8).

## Long-Term Impact
The `CredentialVerifier` interface is the seam future SSO/SAML lands behind; `mfa_required` remains a first-class verdict in the type surface even though **MFA was implemented and then withdrawn (owner decision, 2026-07-21)** — keeping the outcome typed means re-introducing a challenge flow is additive rather than a re-design of the login service. Portal logins (Doc 12 §1) reuse the same protection stack with their own role gate. The security-event catalogue becomes the feed for incident tooling (SOP 17.14).
