/**
 * One-time bootstrap: provision the FIRST Founder account.
 *
 * Founder is the super administrator. In-app, only an existing Founder or an
 * existing System Administrator may assign the role (policy revised
 * 2026-07-24) — every other role is refused, and that guard is what makes the
 * seat genuinely held rather than merely configured. But at bootstrap time
 * neither exists yet, so the very first Founder still cannot be created from
 * inside the application at all. This script is that single, deliberate
 * exception, and it is why it runs off a service-account key rather than a
 * session: possession of the key IS the authorisation.
 *
 * The safety property that matters: it REFUSES if any Founder already exists.
 * Without that check this script would be a permanent privilege-escalation
 * backdoor — anyone who ever obtained the key could mint themselves a second
 * super administrator. Once the first Founder exists, every further grant or
 * transfer goes through the audited in-app flow, where an existing Founder or
 * System Administrator must authorise it.
 *
 * Usage (PowerShell, from crm/):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
 *   node scripts/bootstrap-founder.mjs --email you@example.com --name "Your Name"
 *
 * Creates the Auth user WITHOUT a password and prints a reset link — no
 * credential ever passes through the terminal (Doc 10 secrets discipline).
 *
 * To deliberately replace a lost Founder, pass --force. That is an audited
 * emergency action: it is recorded as an `override` with a reason, because a
 * second super administrator appearing is exactly the event a reviewer needs
 * to be able to find later.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const email = arg('email');
const displayName = arg('name') ?? 'Founder';
const force = hasFlag('force');

if (!email) {
  console.error(
    'Usage: node scripts/bootstrap-founder.mjs --email <email> [--name "Full Name"] [--force]',
  );
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the service-account key file path.');
  process.exit(1);
}

const app = initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const auth = getAuth(app);
const db = getFirestore(app);

// ── The gate ──────────────────────────────────────────────────────────────
const existing = await db
  .collection('users')
  .where('role', '==', 'founder')
  .where('deletedAt', '==', null)
  .get();

if (!existing.empty && !force) {
  console.error(`\nRefusing: ${existing.size} Founder account(s) already exist.\n`);
  for (const doc of existing.docs) {
    console.error(`  · ${doc.get('email')} (${doc.get('status')})`);
  }
  console.error(
    '\nFounder is assignable in-app by an existing Founder or System Administrator — use Admin → Users.\n' +
      'Only if every Founder is genuinely unrecoverable, re-run with --force.\n' +
      'That is an audited emergency action.\n',
  );
  process.exit(1);
}

const BRANCH_ID = 'HQ';
const claims = { role: 'founder', branchId: BRANCH_ID };

let user;
try {
  user = await auth.getUserByEmail(email);
  console.log(`User exists (${user.uid}) — re-asserting claims and profile.`);
} catch {
  user = await auth.createUser({ email, displayName, emailVerified: false });
  console.log(`Created auth user ${user.uid}.`);
}

await auth.setCustomUserClaims(user.uid, claims);

const now = FieldValue.serverTimestamp();
await db.collection('users').doc(user.uid).set(
  {
    schemaVersion: 1,
    branchId: BRANCH_ID,
    displayName,
    email,
    phone: '',
    role: 'founder',
    status: 'active',
    assignedBatchIds: [],
    photoUrl: null,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
    deletedAt: null,
    deletedBy: null,
  },
  { merge: true },
);

await db.collection('auditLogs').add({
  schemaVersion: 1,
  branchId: BRANCH_ID,
  at: now,
  actorUid: 'system',
  actorRole: 'system',
  // A forced re-bootstrap is an override, not a routine create — it must
  // stand out in the register, carrying its reason.
  action: force && !existing.empty ? 'override' : 'permission_change',
  entityType: 'user',
  entityId: user.uid,
  entityPath: `users/${user.uid}`,
  changes: { role: { before: null, after: 'founder' } },
  context: {
    feature: 'bootstrap',
    reason:
      force && !existing.empty
        ? 'FORCED founder bootstrap — pre-existing Founder account(s) were present'
        : 'initial founder provisioning',
  },
});

const resetLink = await auth.generatePasswordResetLink(email);
console.log('\nFounder bootstrap complete.');
console.log('Open this link in your browser to set your password (expires in 1 hour):\n');
console.log(resetLink);
console.log('\nThen sign in at the CRM /login page.');
console.log(
  '\nEvery further Founder grant or transfer happens in-app, authorised by a Founder or System Administrator.',
);
