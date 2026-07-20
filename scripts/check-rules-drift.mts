/**
 * Firestore rules drift-check (Condition C-1, Doc 10 §3).
 *
 * Re-generates the RBAC predicate block in memory and compares it to
 * what is currently in firestore.rules. Exits 1 if they differ (CI gate).
 *
 * Usage:
 *   npx tsx scripts/check-rules-drift.mts
 *
 * Added to .github/workflows/ci.yml as a required step before build.
 * The step must run after the generate step so local changes are validated.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-ignore — scripts/ excluded from app tsconfig intentionally.
import { generatePredicateBlock, generateRulesWithPredicates } from './generate-firestore-predicates.mts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../firestore.rules');

const currentRules = readFileSync(RULES_PATH, 'utf8');
const predicateBlock = generatePredicateBlock() as string;
const expectedRules = generateRulesWithPredicates(currentRules, predicateBlock) as string;

if (currentRules.trim() !== expectedRules.trim()) {
  console.error('');
  console.error('❌ firestore.rules has drifted from lib/rbac/permissions.ts!');
  console.error('');
  console.error(
    '   Run: npx tsx scripts/generate-firestore-predicates.mts',
  );
  console.error('   Then commit the updated firestore.rules.');
  console.error('');
  process.exit(1);
} else {
  console.log('✓ firestore.rules RBAC predicates are in sync with permissions.ts');
}
