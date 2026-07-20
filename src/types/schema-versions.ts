/**
 * Current schemaVersion per collection (Doc 03 §7 versioning strategy).
 * Bumping a version requires a converter migration + ADR note in the same PR.
 */
export const SCHEMA_VERSIONS = {
  users: 1,
  settings: 1,
  auditLogs: 1,
  loginSecurity: 1,
  loginAttempts: 1,
  securityEvents: 1,
} as const;

export type VersionedCollection = keyof typeof SCHEMA_VERSIONS;
