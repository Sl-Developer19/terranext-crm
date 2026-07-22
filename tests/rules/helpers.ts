import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Shared harness for the Firestore rules suite (Doc 18).
 *
 * The whole point of these tests is that they exercise the *deployed artefact*
 * — `firestore.rules` as written, including the generated RBAC predicates —
 * rather than a restatement of the policy in TypeScript. A drift between
 * permissions.ts and the rules file is caught by `check:rules-drift`; this
 * suite catches the rules file being wrong on its own terms.
 */

export const PROJECT_ID = 'terranext-rules-test';

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}

/** Every staff role in the permission map, for allow/deny matrices. */
export const ROLES = [
  'founder',
  'system_admin',
  'ops_manager',
  'consultant',
  'coordinator',
  'trainer',
  'finance',
  'placement',
] as const;
export type Role = (typeof ROLES)[number];

export function authed(env: RulesTestEnvironment, uid: string, role: Role) {
  return env.authenticatedContext(uid, { role }).firestore();
}

export function anon(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().firestore();
}
