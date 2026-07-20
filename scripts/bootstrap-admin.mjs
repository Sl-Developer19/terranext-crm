/**
 * One-time bootstrap: provision the FIRST system_admin account.
 * Every later account is created through the in-app user management flow —
 * this script exists only because provisioning requires a system_admin,
 * and initially none exists.
 *
 * Usage (PowerShell, from crm/):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\Lokesh\.secrets\terranextglobal-service-account.json"
 *   node scripts/bootstrap-admin.mjs --email you@example.com --name "Your Name"
 *
 * The script creates the Auth user WITHOUT a password and prints a password
 * reset link — open it to set the password yourself. No credentials ever
 * pass through the terminal or this chat (Doc 10 secrets discipline).
 * Re-running for an existing email is safe: it re-asserts claims and doc.
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg('email');
const displayName = arg('name') ?? 'System Administrator';
if (!email) {
  console.error('Usage: node scripts/bootstrap-admin.mjs --email <email> [--name "Full Name"]');
  process.exit(1);
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the service-account key file path.');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))),
});
const auth = getAuth(app);
const db = getFirestore(app);

const claims = { role: 'system_admin', branchId: 'HQ' };

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
    branchId: 'HQ',
    displayName,
    email,
    phone: '',
    role: 'system_admin',
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
  branchId: 'HQ',
  at: now,
  actorUid: 'system',
  actorRole: 'system',
  action: 'permission_change',
  entityType: 'user',
  entityId: user.uid,
  entityPath: `users/${user.uid}`,
  changes: { role: { before: null, after: 'system_admin' } },
  context: { feature: 'bootstrap', reason: 'initial system_admin provisioning' },
});

const resetLink = await auth.generatePasswordResetLink(email);
console.log('\nBootstrap complete.');
console.log('Open this link in your browser to set your password (expires in 1 hour):\n');
console.log(resetLink);
console.log('\nThen sign in at the CRM /login page.');
