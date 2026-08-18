/**
 * ============================================================================
 * ACADEMY CATALOGUE SEED — scripts/seed-academy-catalogue.mjs
 * ============================================================================
 *
 * Creates the six real TerraNext academies in the CRM's `academies` catalogue
 * collection, matching the website's finalized content. As of the website's
 * relaunch, this collection has zero rows matching the new taxonomy — the
 * catalogue is admin-configured reference data, not hardcoded, so nothing in
 * application code seeded it automatically.
 *
 * SCOPE — academies only, not programmes. `programmeSchema` (src/features/
 * catalogue/schema.ts) requires `totalFeePaise`, `minAttendancePct`, and
 * `minAssessmentScore` on every programme — real pricing and certificate-gate
 * decisions that exist nowhere in the website's source content. Inventing
 * them here would create programme records with fabricated business terms.
 * Once those figures are decided, create programmes through the CRM's own
 * Admin → Catalogue UI (`createProgramme`, RBAC + audit-logged like any other
 * admin action) — this script deliberately stops at academies.
 *
 * SAFETY MODEL — mirrors scripts/reset-crm-data.ts exactly:
 *   1. No flags = REPORT ONLY. Prints what would be created. Zero writes.
 *   2. Creating anything requires the CLI flag `--confirm`.
 *   3. Slugs are checked first — an academy whose slug already exists is
 *      skipped and reported, never duplicated or overwritten. Re-running
 *      this script after a partial run (or after the real data already
 *      exists) is safe.
 *   4. Requires GOOGLE_APPLICATION_CREDENTIALS (or FIRESTORE_EMULATOR_HOST
 *      for a local test run first) — same as every other privileged script
 *      in this directory.
 *   5. Writes go through the Admin SDK directly (bypassing the app-layer
 *      session/RBAC check, same as bootstrap-founder.mjs) because there is
 *      no signed-in staff session in a standalone script context — but each
 *      write gets a matching `auditLogs` entry so the compliance trail
 *      (ADR-007) still records exactly what happened and why.
 *
 * USAGE (from the `crm/` directory)
 *   Report only (always safe, no writes, no flags needed):
 *     node scripts/seed-academy-catalogue.mjs
 *
 *   Test against the Firestore emulator first:
 *     $env:FIRESTORE_EMULATOR_HOST="localhost:8080"
 *     node scripts/seed-academy-catalogue.mjs --confirm
 *
 *   Actually create, against whatever GOOGLE_APPLICATION_CREDENTIALS
 *   points at:
 *     $env:GOOGLE_APPLICATION_CREDENTIALS="C:\...\service-account.json"
 *     node scripts/seed-academy-catalogue.mjs --confirm
 * ============================================================================
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

/**
 * Slugs match the website's real `/academies/<slug>` routes exactly (see
 * `academyToSlug`/`ACADEMY_ROUTE_SLUGS` in terranext/lib/crm.ts) — this is
 * what makes a lead's `programmeInterestSlug` resolvable back to a real
 * catalogue academy once the lead-intake → catalogue FK linkage is built.
 * NextStep lives at the top-level `/nextstep` route, not under `/academies`,
 * so its slug is simply "nextstep" rather than an `/academies/*` fragment.
 *
 * Descriptions are the taglines already live on the website — nothing
 * invented here.
 */
const ACADEMIES = [
  {
    name: 'NextGen Transformation Academy',
    slug: 'nextgen-transformation',
    description:
      'Transform the person before preparing the professional. The flagship 30-Day Transformation Journey for young people.',
  },
  {
    name: 'Family Transformation Academy',
    slug: 'family-transformation',
    description: 'Two generations, one family, better understanding.',
  },
  {
    name: 'Faculty Development Academy',
    slug: 'faculty-development',
    description: "Don't just teach. Learn how to connect.",
  },
  {
    name: 'Career & Global Placement Academy',
    slug: 'career-global-placement',
    description:
      'From campus to career, from India to the global workplace. Includes the flagship GLOBAL30 international-readiness programme.',
  },
  {
    name: 'AI Career Accelerator',
    slug: 'ai-career-accelerator',
    description: "Don't just learn AI. Learn how to build a career with it.",
  },
  {
    name: 'NextStep',
    slug: 'nextstep',
    description:
      'Post-transformation mentorship, accountability and progress — for participants who have completed an eligible TerraNext programme.',
  },
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
  const snap = await db.collection('academies').where('slug', '==', slug).limit(1).get();
  return !snap.empty;
}

async function main() {
  const args = process.argv.slice(2);
  const confirmFlag = args.includes('--confirm');

  const db = initFirestore();
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  console.log('\n=== Academy Catalogue Seed — Report ===\n');
  console.log('Academy'.padEnd(38) + 'Slug'.padEnd(28) + 'Status');
  console.log('-'.repeat(80));

  const toCreate = [];
  for (const academy of ACADEMIES) {
    const taken = await isSlugTaken(db, academy.slug);
    console.log(
      academy.name.padEnd(38) +
        academy.slug.padEnd(28) +
        (taken ? 'ALREADY EXISTS — skip' : 'WILL BE CREATED'),
    );
    if (!taken) toCreate.push(academy);
  }

  console.log(
    `\n${toCreate.length} of ${ACADEMIES.length} academies will be created` +
      (toCreate.length < ACADEMIES.length
        ? '; the rest already exist and are left untouched.'
        : '.'),
  );
  console.log(
    '\nNote: this script does not create programmes — see the file header for why (real fee/attendance/\n' +
      'assessment figures are needed first, and none exist in the website content this was seeded from).\n',
  );

  if (!confirmFlag) {
    console.log(
      'Dry run only — no data was modified. Pass --confirm to proceed to the create step.\n',
    );
    return;
  }

  if (toCreate.length === 0) {
    console.log('Nothing to create — all six academies already exist.\n');
    return;
  }

  console.log('='.repeat(80));
  console.log(
    usingEmulator ? 'Connected to the Firestore emulator.' : '⚠️  Writing to a REAL project.',
  );
  console.log('='.repeat(80) + '\n');

  const now = new Date();
  for (const academy of toCreate) {
    // Display order follows the master doc's canonical 01-06 listing, spaced
    // by 10 so a later manual reorder in Settings doesn't require renumbering
    // every academy after it.
    const displayOrder = ACADEMIES.indexOf(academy) * 10;
    const ref = db.collection('academies').doc();
    await ref.set({
      schemaVersion: 1,
      branchId: BRANCH_ID,
      name: academy.name,
      slug: academy.slug,
      description: academy.description,
      displayOrder,
      // No real icon/theme colour exists anywhere in the source content —
      // left unset rather than invented; set later in Settings if wanted.
      icon: null,
      themeColor: null,
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
      entityType: 'academy',
      entityId: ref.id,
      entityPath: `academies/${ref.id}`,
      context: {
        feature: 'catalogue',
        reason: 'seed script — six-academy website relaunch (scripts/seed-academy-catalogue.mjs)',
      },
    });

    console.log(`  created: ${academy.name} (${ref.id})`);
  }

  console.log('\nDone. Programmes were not created — see file header.\n');
}

main().catch((error) => {
  console.error('\nSeed script failed:', error);
  process.exit(1);
});
