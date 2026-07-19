/**
 * Conventional Commits enforcement (Doc 09 §3).
 * Scope should be the feature/module name; BR/FR references belong in the body.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'chore', 'security'],
    ],
    'header-max-length': [2, 'always', 72],
  },
};
