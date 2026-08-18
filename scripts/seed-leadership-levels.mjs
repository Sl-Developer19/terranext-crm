/**
 * ============================================================================
 * LEADERSHIP LEVELS SEED — scripts/seed-leadership-levels.mjs
 * ============================================================================
 *
 * Creates the four Growth Partner recognition tiers in the CRM's
 * `leadershipLevels` collection (Settings §3), matching the slugs that
 * already exist as free-text values on `growthPartners.leadershipLevel`
 * records created before this collection existed. Until these documents
 * exist, `findLeadershipLevelBySlug('bronze' | 'silver' | 'gold' | 'platinum')`
 * returns null for any partner still on the old hardcoded default, and
 * `findDefaultLeadershipLevelSlug()` returns null for every new registration
 * (registration itself still succeeds — see repository.ts).
 *
 * Names/order/description are the same four tiers previously hardcoded as
 * `LEADERSHIP_LEVELS` in growth-partners/schema.ts — nothing new invented
 * here, just moved into admin-configured data. No badge colour/icon existed
 * anywhere in the source content, so both are left unset (editable later in
 * Settings).
 *
 * SAFETY MODEL — identical to scripts/seed-academy-catalogue.mjs:
 *   1. No flags = REPORT ONLY. Prints what would be created. Zero writes.
 *   2. Creating anything requires the CLI flag `--confirm`.
 *   3. Slugs are checked first — a level whose slug already exists is
 *      skipped and reported, never duplicated or overwritten. Re-running
 *      this script is safe.
 *   4. Requires GOOGLE_APPLICATION_CREDENTIALS (or FIRESTORE_EMULATOR_HOST
 *      for a local test run first).
 *   5. Writes go through the Admin SDK directly (no signed-in staff session
 *      in a standalone script context) but each write gets a matching
 *      `auditLogs` entry (ADR-007).
 *
 * USAGE (from the `crm/` directory)
 *   Report only (always safe, no writes, no flags needed):
 *     node scripts/seed-leadership-levels.mjs
 *
 *   Test against the Firestore emulator first:
 *     $env:FIRESTORE_EMULATOR_HOST="localhost:8080"
 *     node scripts/seed-leadership-levels.mjs --confirm
 *
 *   Actually create, against whatever GOOGLE_APPLICATION_CREDENTIALS
 *   points at:
 *     $env:GOOGLE_APPLICATION_CREDENTIALS="C:\...\service-account.json"
 *     node scripts/seed-leadership-levels.mjs --confirm
 * ============================================================================
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const LEVELS = [
  { name: 'Bronze', slug: 'bronze', description: 'Entry-level Growth Partner recognition tier.' },
  { name: 'Silver', slug: 'silver', description: 'Mid-level Growth Partner recognition tier.' },
  { name: 'Gold', slug: 'gold', description: 'Senior Growth Partner recognition tier.' },
  { name: 'Platinum', slug: 'platinum', description: 'Top Growth Partner recognition tier.' },
];

const BRANCH_ID = 'HQ';

function initFirestore() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  if (!keyPath && !usingEmulator) {
    console.error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to a service-account key file, or set ' +
        'FIRESTORE_EMULATOR_HOST to point at a local emulator.',
    );
    process.exit(1);
  }

  const app = keyPath
    ? initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
    : initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'terranextglobal' });

  return getFirestore(app);
}

async function isSlugTaken(db, slug) {
  const snap = await db.collection('leadershipLevels').where('slug', '==', slug).limit(1).get();
  return !snap.empty;
}

async function main() {
  const args = process.argv.slice(2);
  const confirmFlag = args.includes('--confirm');

  const db = initFirestore();
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  console.log('\n=== Leadership Levels Seed — Report ===\n');
  console.log('Level'.padEnd(16) + 'Slug'.padEnd(16) + 'Status');
  console.log('-'.repeat(60));

  const toCreate = [];
  for (const level of LEVELS) {
    const taken = await isSlugTaken(db, level.slug);
    console.log(
      level.name.padEnd(16) +
        level.slug.padEnd(16) +
        (taken ? 'ALREADY EXISTS — skip' : 'WILL BE CREATED'),
    );
    if (!taken) toCreate.push(level);
  }

  console.log(
    `\n${toCreate.length} of ${LEVELS.length} levels will be created` +
      (toCreate.length < LEVELS.length ? '; the rest already exist and are left untouched.' : '.'),
  );

  if (!confirmFlag) {
    console.log(
      'Dry run only — no data was modified. Pass --confirm to proceed to the create step.\n',
    );
    return;
  }

  if (toCreate.length === 0) {
    console.log('Nothing to create — all four levels already exist.\n');
    return;
  }

  console.log('='.repeat(60));
  console.log(
    usingEmulator ? 'Connected to the Firestore emulator.' : '⚠️  Writing to a REAL project.',
  );
  console.log('='.repeat(60) + '\n');

  const now = new Date();
  for (const level of toCreate) {
    const displayOrder = LEVELS.indexOf(level) * 10;
    const ref = db.collection('leadershipLevels').doc();
    await ref.set({
      schemaVersion: 1,
      branchId: BRANCH_ID,
      name: level.name,
      slug: level.slug,
      description: level.description,
      displayOrder,
      badgeColor: null,
      badgeIcon: null,
      status: 'active',
      createdAt: now,
      createdBy: 'system',
      updatedAt: now,
      updatedBy: 'system',
      deletedAt: null,
      deletedBy: null,
    });

    await db.collection('auditLogs').add({
      schemaVersion: 1,
      branchId: BRANCH_ID,
      at: now,
      actorUid: 'system',
      actorRole: 'system',
      action: 'create',
      entityType: 'leadership_level',
      entityId: ref.id,
      entityPath: `leadershipLevels/${ref.id}`,
      context: {
        feature: 'leadership-levels',
        reason:
          'seed script — preserving the four pre-existing tiers as configurable data (scripts/seed-leadership-levels.mjs)',
      },
    });

    console.log(`  created: ${level.name} (${ref.id})`);
  }

  console.log('\nDone.\n');
}

main().catch((error) => {
  console.error('\nSeed script failed:', error);
  process.exit(1);
});
