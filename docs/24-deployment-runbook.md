# 24 — Deployment Runbook & Go-Live Checklist

**TerraNext Business OS · Operations**
Everything required to take the CRM from a green build to a running production system. Written to be followed literally, in order, by someone who did not write the code.

---

## 1. Environment Variables

Set on the App Hosting backend (`firebase apphosting:secrets:set` for secrets, `apphosting.yaml` env block for non-secrets). **Nothing here belongs in git.**

### 1.1 Required — the app will not function without these

| Variable | Purpose | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Client SDK | Public by design (not a secret) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client SDK | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Client SDK | |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Admin SDK | **Secret.** JSON, single line. On App Hosting the default service account is used instead — set only if running elsewhere |
| `SESSION_COOKIE_SECRET` | Session cookie signing | **Secret.** ≥32 random bytes |

### 1.2 Required for scheduled jobs

| Variable | Purpose |
|---|---|
| `JOBS_SECRET` | **Secret.** Bearer token Cloud Scheduler presents to `/api/jobs/*`. Generate with `openssl rand -base64 48`. **If unset, every job endpoint refuses all requests** — deliberately fail-closed |

### 1.3 Messaging providers — optional, but messages stay `queued` without them

| Variable | Values | Notes |
|---|---|---|
| `EMAIL_PROVIDER` | `resend` \| `sendgrid` | Unset ⇒ email never sends; log shows `queued` with a reason |
| `RESEND_API_KEY` / `SENDGRID_API_KEY` | — | **Secret.** Matching the chosen provider. The *only* hard requirement — sender identity has defaults |
| `SMS_PROVIDER` | `twilio` | Unset ⇒ SMS/WhatsApp never send |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | — | **Secret.** |
| `TWILIO_FROM` | E.164 number | WhatsApp reuses this with a `whatsapp:` prefix |

### 1.4 Public intake

| Variable | Purpose |
|---|---|
| `PUBLIC_INTAKE_ORIGINS` | Comma-separated website origins allowed to POST `/api/createLead`. Defaults to the production domains in `src/config/public-intake.ts` |

### 1.5 Sender identity — defaults ship in code

`src/config/organisation.ts` is the single source of truth for outbound identity. Defaults:

| Field | Value |
|---|---|
| Sender name | TerraNext Global Ventures |
| Sender email | pp@terranextglobal.com |
| Reply-To | pp@terranextglobal.com |
| Contact number | +91 81243 60360 |

These appear in the `From` header, `Reply-To`, every email footer, SMS/WhatsApp signatures, and templates that invite the reader to call. Changing the number is a one-line edit there — never a sweep through templates.

Override per environment with `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`, `ORG_CONTACT_PHONE`, `ORG_CONTACT_PHONE_DISPLAY`. **Do this on staging**, so a test deploy cannot send as the live business. The sending address must be a verified sender on the provider or mail will be rejected.

---

## 2. Deployment Commands

Run from the repository root. **Deploy rules and indexes before the app** — a new build that queries an index that does not exist yet will error in production.

```bash
# 0. Verify locally first. All five must pass.
npm run typecheck
npm run lint
npm run test
npm run build
npm run check:rules-drift

# 1. Authenticate and select the project
firebase login
firebase use terranextglobal

# 2. Security rules (Firestore + Storage)
firebase deploy --only firestore:rules,storage

# 3. Indexes — builds are asynchronous and can take minutes on a large
#    collection. Wait for "Enabled" in the console before step 5.
firebase deploy --only firestore:indexes

# 4. Cloud Functions (scheduled Firestore export lives here)
firebase deploy --only functions

# 5. The application (App Hosting)
firebase deploy --only apphosting
```

### 2.1 Rollback

App Hosting keeps prior rollouts. Roll back from the console, or:

```bash
firebase apphosting:rollouts:list --backend terranext-crm
firebase apphosting:rollouts:create --backend terranext-crm --git-revision <previous-sha>
```

Rules and indexes are **not** covered by that rollback. To revert rules, check out the previous `firestore.rules` and redeploy step 2. Indexes are additive — removing one is safe only once nothing queries it.

---

## 3. One-Time Project Configuration

These cannot be done from application code. Each is required once per project.

1. **Firestore TTL policy** — collection `rateLimits`, field `expiresAt`. Without it, rate-limit counter documents accumulate forever.
   `Firestore → TTL → Create policy`
2. **App Check** — register the App Hosting site and the website, then enforce on Firestore. The intake endpoint already forwards `X-Firebase-AppCheck`.
3. **Point-in-Time Recovery** — `Firestore → Backups → Enable PITR` (7-day window).
4. **Export bucket + IAM** — see §5.
5. **Budget alerts** — Billing → Budgets. Set at expected monthly spend and 150%.
6. **Cloud Scheduler jobs** — see §4.
7. **Authorised domains** — Authentication → Settings → Authorised domains: add the production CRM domain.

---

## 3a. Founder Bootstrap (once, before first sign-in)

Founder is the super administrator. **Only an existing Founder or an existing System Administrator may assign the Founder role** (policy revised 2026-07-24) — in-app and in `provisionUser` alike; every other role is refused. The very first Founder still cannot come from inside the application, since bootstrap time has neither — this script is the single deliberate exception, authorised by possession of the service-account key.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node scripts/bootstrap-founder.mjs --email founder@terranextglobal.com --name "Full Name"
```

It creates the account **without a password** and prints a one-hour reset link — no credential passes through the terminal.

**It refuses to run if any Founder already exists.** That check is what stops the script being a permanent privilege-escalation backdoor. After the first Founder exists, every further grant or transfer goes through the audited in-app flow.

`--force` overrides the refusal for a genuinely unrecoverable Founder. It is recorded in the audit register as an `override` carrying its reason, because a second super administrator appearing is exactly the event a reviewer needs to find later.

### Transferring ownership

Two audited steps. Neither can be self-performed — no one, Founder included, can change their own role (`isSelfTargeting` blocks it unconditionally, regardless of this policy change), so a transfer always takes two distinct people:

1. Someone promotes the successor to Founder (Admin → Users) — the outgoing Founder or a System Administrator may do this (`canAssignRole`).
2. Someone else demotes the outgoing Founder to another role — the new Founder, another existing Founder, or a System Administrator.

Order matters. The last-holder guard blocks step 2 until a second Founder exists, which is the point — there is no window where the platform has no Founder. `canAssignRole` governs who may *grant* Founder; who may *remove* it is governed separately by the last-holder guard (`wouldStrandPlatform` / `leavesProtectedRole`), which this policy change does not touch.

---

## 4. Cloud Scheduler Jobs

Three jobs. All POST with the `JOBS_SECRET` bearer token. Replace `$CRM_URL` and `$JOBS_SECRET`.

```bash
# Communications dispatch — every 5 minutes
gcloud scheduler jobs create http dispatch-communications \
  --location=asia-south1 \
  --schedule="*/5 * * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="$CRM_URL/api/jobs/dispatch-communications" \
  --http-method=POST \
  --headers="Authorization=Bearer $JOBS_SECRET" \
  --attempt-deadline=60s

# Overdue fee installments — daily 01:00 IST
gcloud scheduler jobs create http mark-overdue-installments \
  --location=asia-south1 \
  --schedule="0 1 * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="$CRM_URL/api/jobs/daily?job=mark-overdue" \
  --http-method=POST \
  --headers="Authorization=Bearer $JOBS_SECRET" \
  --attempt-deadline=300s

# Follow-up digest — daily 08:00 IST
gcloud scheduler jobs create http follow-up-digest \
  --location=asia-south1 \
  --schedule="0 8 * * *" \
  --time-zone="Asia/Kolkata" \
  --uri="$CRM_URL/api/jobs/daily?job=follow-up-digest" \
  --http-method=POST \
  --headers="Authorization=Bearer $JOBS_SECRET" \
  --attempt-deadline=300s
```

All three are idempotent: dispatch only moves `queued` rows forward, the overdue sweep only changes rows whose state actually differs, and digests are re-enqueued per run by design. A duplicate delivery from Scheduler is therefore harmless.

---

## 5. Backup & Restore

### 5.1 What protects what

| Mechanism | Recovers from | Window |
|---|---|---|
| **PITR** | Bad write, accidental delete, faulty migration | Last 7 days, to the minute |
| **Scheduled export** | Project-level loss; long-term retention | Weekly, Sunday 02:00 IST |
| **Audit log** | Answering *who changed what* — not a recovery mechanism | Indefinite |

### 5.2 One-time export setup

```bash
gcloud storage buckets create gs://terranext-firestore-exports \
  --location=asia-south1 --uniform-bucket-level-access

# Retain a year of exports, then expire
gcloud storage buckets update gs://terranext-firestore-exports \
  --lifecycle-file=lifecycle.json   # {"rule":[{"action":{"type":"Delete"},"condition":{"age":365}}]}

# The Functions runtime service account must be able to export and write
PROJECT_NUMBER=$(gcloud projects describe terranextglobal --format='value(projectNumber)')
gcloud projects add-iam-policy-binding terranextglobal \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"
gcloud storage buckets add-iam-policy-binding gs://terranext-firestore-exports \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### 5.3 Restore

```bash
# Point-in-time (preferred — no data loss beyond the chosen minute)
gcloud firestore databases restore \
  --source-database='(default)' \
  --destination-database='restored-db' \
  --snapshot-time='2026-07-22T10:00:00Z'

# From a weekly export
gcloud firestore import gs://terranext-firestore-exports/scheduled/<timestamp>
```

**Restore to a new database, never over the live one.** Verify the restored copy, then repoint. An import over a running database merges rather than replaces, which can resurrect deleted records.

### 5.4 Restore drill

Untested backups are not backups. Run once per quarter: restore the most recent export to a scratch database, confirm participant count and a spot-checked record, delete the scratch database. Record the date and result.

---

## 6. Monitoring

### 6.1 Alerts to configure (Cloud Monitoring)

| Alert | Condition | Why |
|---|---|---|
| Error rate | 5xx > 1% over 5 min | User-visible breakage |
| Latency | p95 > 3s over 10 min | Doc 11 budget breach |
| Job failure | Scheduler job non-2xx twice consecutively | Silent job death is the failure mode that hides longest |
| Dispatch backlog | `communications` where `status=queued` > 100 | Provider outage or bad credentials |
| Budget | 100% and 150% of expected spend | Runaway reads |
| Auth failures | `securityEvents` writes spike | Credential-stuffing attempt |

### 6.2 In-app signals

- `/admin/audit-logs` — every privileged action, filterable, exportable.
- `systemEvents` collection — dead-letter entries from Functions.
- `communications` with `status: failed` — carries `failureReason` naming the cause.
- Error Reporting — client errors arrive via `/api/errors/report`.

### 6.3 First checks when something is wrong

1. Recent rollouts — did a deploy coincide?
2. `communications` failures — is a provider credential expired?
3. Scheduler job history — are jobs running at all?
4. Firestore index build state — a pending index breaks queries with `FAILED_PRECONDITION`.

---

## 6a. Firestore Rules Emulator — Verification Report

**Status: PASSED.** Run 2026-07-24, against the deployed `firestore.rules` artefact (not a restatement of the policy — the actual rules file the emulator loads and Firestore will enforce in production).

> **Amendment (2026-07-24, later same day):** the *application-layer* policy for who may assign Founder was revised after this run — System Administrator is now a second permitted grantor alongside Founder (`FOUNDER_ASSIGNERS` in `features/users/logic.ts`). The report below is unchanged and still accurate for what it actually tests: `firestore.rules` denies every client write to `users/*` for every role, which this policy change does not touch and does not need to touch — the assignment guard lives in the server actions, not in rules. Row 5's "System Administrator cannot write" refers specifically to the *direct Firestore write* path, which stays refused; it is no longer true that System Administrator cannot *assign* Founder — see `features/users/logic.test.ts` for that, now-updated, coverage.

**JDK:** 21+ was already satisfied — Temurin JDK 25.0.1 LTS was present on the machine (alongside an older 17), just not the one on `PATH`. No install was required; the emulator was run with `JAVA_HOME` pointed at the 25 install. If your machine has no JDK 21+ at all, install Temurin 21 LTS or newer before running `npm run test:rules`.

```
npm run test:rules

Test Files  1 passed (1)
     Tests  28 passed (28)
  Duration  ~8–20s (emulator start dominates; assertions run in under 2s)
```

### Coverage against the required scenarios

| # | Scenario | Result |
|---|---|---|
| 4 | Founder authorization — reads every collection (business data, `auditLogs`, `settings`, `users`) | ✅ `lets Founder read every collection (super administrator)` |
| 4 | Founder — still refused a direct client write to any collection | ✅ `still refuses Founder a direct client write` |
| 5 | System Administrator cannot write `role: founder` **directly to Firestore** — a client transport check, distinct from the (now-permitted) application-layer *assignment* right | ✅ `refuses a System Administrator writing role: founder to any user doc` |
| 5 | No ordinary role (ops_manager, trainer, …) can write `role: founder` | ✅ `refuses an ordinary role writing role: founder to any user doc` |
| 6 | `users/*` denies client writes for every role, including Founder itself | ✅ `refuses even an authenticated Founder session — the write path itself does not exist` |
| 6 | An existing user doc cannot be merge-edited to add `role: founder` | ✅ `refuses editing an existing user document to add role: founder` |
| 7 | Founder access is structural, not a rules carve-out — every mutation path (`setUserRole`, `provisionUser`, all feature actions) uses `adminDb()`/`adminAuth()`, which bypass rules by design; rules deny every client write regardless of role | ✅ Proven by the full "business collections are read-only to clients" block (founder included) + code inspection of the Admin SDK usage in every action |

### Also covered (full suite, not just the items above)

- Anonymous access denied everywhere (read and write)
- Server-only ledgers (`loginSecurity`, `loginAttempts`, `securityEvents`, `rateLimits`, `counters`) unreadable by any role, including Founder
- Audit log immutability — readable only by founder/system_admin, never updatable or deletable by anyone (ADR-007)
- Row-level scoping: a consultant reads only their own assigned leads, not the whole collection, while founder/ops_manager read every lead — this caught and fixed a test-fixture gap (a seed doc missing `assignedToUid` produced a rules evaluation error rather than a clean allow/deny, which is itself a useful reminder that Firestore rules error on missing-field access rather than treating it as falsy)
- Read scoping matches `permissions.ts` exactly for both grants and denials
- Unknown/missing role claims fail closed rather than defaulting open

### What this does — and does not — prove

Proves: the deployed rules artefact enforces the Founder-assignment guarantees at the transport layer, independent of and in addition to the `canAssignRole` application-layer guard verified in `src/features/users/logic.test.ts`. Two independent layers agree.

Does not prove: production IAM/service-account configuration, or that the deployed rules in the live project match the local file (run `check:rules-drift` and `firebase deploy --only firestore:rules` as normal — this suite is a pre-deploy gate, not a post-deploy check).

**Authorization model status: production-ready per this gate.**

---

## 7. Go-Live Checklist

Nothing here is optional. `[ ]` means unverified.

### Pre-deployment
- [ ] `npm run typecheck` · `lint` · `test` · `build` · `check:rules-drift` all pass
- [x] `npm run test:rules` passes (**requires JDK 21+**) — 28/28, see §6a. Re-run after any further `firestore.rules` edit
- [ ] `npm run perf:lighthouse` passes against `/login` and `/partner/login` (Doc 11 §8, Doc 20 GPMS session)
- [ ] `npm run perf:lighthouse:auth` passes against `/dashboard`, `/reports`, `/participants` on a staging deploy with a seeded perf-test staff account (`PERF_BASE_URL`/`PERF_TEST_EMAIL`/`PERF_TEST_PASSWORD`)
- [ ] All §1 environment variables set on the production backend
- [ ] `JOBS_SECRET` generated and stored in a password manager
- [ ] Messaging provider credentials verified with a real test send
- [ ] `PUBLIC_INTAKE_ORIGINS` matches the live website origin exactly
- [ ] `PUBLIC_INTAKE_ORIGINS` also covers the growth-partner registration form's origin (shared with `createLead`, Doc 25 §4)

### Deployment
- [ ] Rules deployed and spot-checked in the Rules Playground
- [ ] Indexes deployed and **all showing Enabled**
- [ ] Functions deployed
- [ ] App deployed; the rollout is serving

### Post-deployment verification
- [ ] Founder bootstrapped (§3a); password set via the reset link
- [ ] Re-running the bootstrap script is **refused** (proves the backdoor is closed)
- [ ] A Founder or System Administrator CAN assign the Founder role in Admin → Users; an ordinary role (e.g. ops_manager) CANNOT
- [ ] Sign in as each of the 8 roles; confirm the nav matches the permission map
- [ ] A role without a grant is redirected from that module's URL
- [ ] Submit the website enquiry form → lead appears with `source: website`, `stage: new`
- [ ] Submit the same phone twice → second is deduped, activity appended
- [ ] Record a counselling session → lead moves stage
- [ ] Convert a lead → permanent ID issued, fee account created, audit entry written
- [ ] Issue a certificate → alumni record created (BR-05)
- [ ] Export a report → file downloads and an `export` audit entry appears
- [ ] Upload a participant document → stored and retrievable
- [ ] Response headers include CSP and HSTS (`curl -I https://<crm-domain>`)
- [ ] Submit the website Growth Partner registration form → `growthPartners` doc appears, `status: pending_approval`
- [ ] Approve the pending partner (founder/system_admin/ops_manager) → Firebase Auth user minted, partner can sign in at `/partner/login`
- [ ] Signed-in partner submits a referral → `leads` doc with `source: referral`, `partnerId` set; partner sees it under "My Leads" only (no other partner's leads visible)
- [ ] Convert the referred lead and record a payment → `rewardLedger` entry created, partner's `wallets` balance credited, in the same transaction as the payment
- [ ] Partner requests a payout → appears in `/payouts` queue; finance/founder approves → wallet debited, status `paid`
- [ ] A second, unrelated partner account cannot read the first partner's `growthPartners`/`wallets`/`rewardLedger`/leads (spot-check in Rules Playground or via a second portal session)

### Operational readiness
- [ ] All three Scheduler jobs created and each manually triggered once successfully
- [ ] PITR enabled
- [ ] Export bucket created, IAM granted, one export completed
- [ ] TTL policy on `rateLimits.expiresAt`
- [ ] App Check enforced
- [ ] Budget alerts active
- [ ] Monitoring alerts from §6.1 created
- [ ] Restore drill completed and recorded

### Sign-off
- [ ] UAT against FR-01…FR-10 signed (BRD §29) — see `docs/26-uat-signoff-report.md`
- [ ] Security review of public endpoints signed — see `docs/27-security-review-public-endpoints.md`
- [ ] Owner sign-off recorded with date

---

## 8. CI Gates (as of 2026-07-26 reconciliation)

`.github/workflows/ci.yml` runs three jobs:

| Job | Trigger | Blocks merge? |
|---|---|---|
| `quality` (typecheck, lint, unit tests, rules drift-check, build) | every push + PR | yes |
| `rules` (Firestore emulator deny-tests, Doc 18) | every push + PR | yes |
| `perf` (Lighthouse CI, public shell only) | push to `main` only | no — reports, per Doc 11 §8's release cadence, not per-PR |

`npm run perf:lighthouse:auth` (authenticated routes) is **not** wired into CI — it needs a live staging deploy and a seeded perf-test staff account, so it's a manual pre-release step (§7 Pre-deployment) until a staging environment + secret rotation process exists to automate it safely.
