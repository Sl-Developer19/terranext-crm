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
| `RESEND_API_KEY` / `SENDGRID_API_KEY` | — | **Secret.** Matching the chosen provider |
| `EMAIL_FROM` | e.g. `no-reply@terranextglobal.com` | Must be a verified sender on the provider |
| `SMS_PROVIDER` | `twilio` | Unset ⇒ SMS/WhatsApp never send |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | — | **Secret.** |
| `TWILIO_FROM` | E.164 number | WhatsApp reuses this with a `whatsapp:` prefix |

### 1.4 Public intake

| Variable | Purpose |
|---|---|
| `PUBLIC_INTAKE_ORIGINS` | Comma-separated website origins allowed to POST `/api/createLead`. Defaults to the production domains in `src/config/public-intake.ts` |

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

## 7. Go-Live Checklist

Nothing here is optional. `[ ]` means unverified.

### Pre-deployment
- [ ] `npm run typecheck` · `lint` · `test` · `build` · `check:rules-drift` all pass
- [ ] `npm run test:rules` passes (**requires JDK 21+**)
- [ ] All §1 environment variables set on the production backend
- [ ] `JOBS_SECRET` generated and stored in a password manager
- [ ] Messaging provider credentials verified with a real test send
- [ ] `PUBLIC_INTAKE_ORIGINS` matches the live website origin exactly

### Deployment
- [ ] Rules deployed and spot-checked in the Rules Playground
- [ ] Indexes deployed and **all showing Enabled**
- [ ] Functions deployed
- [ ] App deployed; the rollout is serving

### Post-deployment verification
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
- [ ] UAT against FR-01…FR-10 signed (BRD §29)
- [ ] Owner sign-off recorded with date
