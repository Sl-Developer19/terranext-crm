/**
 * Firestore rules predicate codegen (Condition C-1, Doc 10 §3).
 *
 * Reads ROLE_PERMISSIONS from lib/rbac/permissions.ts and generates
 * a `can(module, action)` function block for firestore.rules.
 * The generated block is inserted between the sentinel comments
 * // <<GENERATED_RBAC_START>> and // <<GENERATED_RBAC_END>>.
 *
 * Usage:
 *   npx tsx scripts/generate-firestore-predicates.mts
 *
 * The script is idempotent — running it twice produces the same output.
 * Run it after any change to lib/rbac/permissions.ts, then re-deploy rules.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Relative import — tsx resolves TS without needing path aliases.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — scripts/ is excluded from the app tsconfig intentionally.
import { ROLE_PERMISSIONS, MODULES, ACTIONS } from '../src/lib/rbac/permissions.ts';
import { STAFF_ROLES } from '../src/types/common.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(__dirname, '../firestore.rules');

const START_MARKER = '// <<GENERATED_RBAC_START>>';
const END_MARKER = '// <<GENERATED_RBAC_END>>';

/** Generate the Firestore rules `can()` predicate block from the permission map. */
export function generatePredicateBlock(): string {
  // Stable serialisation for the hash
  const mapHash = createHash('sha256')
    .update(JSON.stringify(ROLE_PERMISSIONS, Object.keys(ROLE_PERMISSIONS).sort()))
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  const lines: string[] = [
    `    // ── GENERATED RBAC predicates (condition C-1) ──────────────────────────`,
    `    // Source: lib/rbac/permissions.ts · map-version: ${mapHash}`,
    `    // DO NOT EDIT this block manually — run scripts/generate-firestore-predicates.mts`,
    `    // and commit the result. CI will fail if this block has drifted.`,
    `    //`,
    `    // can(module, action): returns true when request.auth has a role that`,
    `    // grants the given module:action. Mirrors ROLE_PERMISSIONS exactly.`,
    ``,
  ];

  // Build one function per module:action pair, listing the roles that have it.
  for (const module of MODULES) {
    for (const action of ACTIONS) {
      const permission = `${module}:${action}`;
      const rolesWithGrant = STAFF_ROLES.filter((role: string) =>
        (ROLE_PERMISSIONS as Record<string, readonly string[]>)[role]?.includes(permission),
      );

      if (rolesWithGrant.length === 0) continue;

      const fnName = `can_${module}_${action}`;
      const roleList = rolesWithGrant.map((r: string) => `'${r}'`).join(', ');
      lines.push(`    function ${fnName}() {`);
      lines.push(`      return isStaff() && request.auth.token.role in [${roleList}];`);
      lines.push(`    }`);
    }
  }

  // Convenience: a single `can(module, action)` dispatcher isn't possible in
  // Firestore rules (no dynamic function dispatch). Instead, callers use the
  // specific `can_<module>_<action>()` helpers above. For documentation, emit
  // a comment showing the full usage pattern.
  lines.push(``);
  lines.push(`    // Usage in rules: instead of 'can("leads", "view")',`);
  lines.push(`    // call can_leads_view(), can_users_create(), etc.`);

  return lines.join('\n');
}

export function generateRulesWithPredicates(currentRules: string, predicateBlock: string): string {
  const startIdx = currentRules.indexOf(START_MARKER);
  const endIdx = currentRules.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    // Markers not present — append before the deny-all wildcard
    const denyAllComment = '    // Deny-all default.';
    const denyIdx = currentRules.indexOf(denyAllComment);
    if (denyIdx === -1) {
      throw new Error(
        'Cannot locate insertion point in firestore.rules. ' +
          'Add // <<GENERATED_RBAC_START>> and // <<GENERATED_RBAC_END>> markers, ' +
          'or ensure the deny-all comment block is present.',
      );
    }
    return (
      currentRules.slice(0, denyIdx) +
      START_MARKER +
      '\n' +
      predicateBlock +
      '\n    ' +
      END_MARKER +
      '\n\n    ' +
      currentRules.slice(denyIdx)
    );
  }

  // Replace between markers
  return (
    currentRules.slice(0, startIdx + START_MARKER.length) +
    '\n' +
    predicateBlock +
    '\n    ' +
    currentRules.slice(endIdx)
  );
}

// Run when executed directly
const currentRules = readFileSync(RULES_PATH, 'utf8');
const predicateBlock = generatePredicateBlock();
const updatedRules = generateRulesWithPredicates(currentRules, predicateBlock);

if (updatedRules === currentRules) {
  console.log('✓ firestore.rules is already up-to-date (no drift).');
} else {
  writeFileSync(RULES_PATH, updatedRules, 'utf8');
  console.log('✓ firestore.rules updated with generated RBAC predicates.');
}
