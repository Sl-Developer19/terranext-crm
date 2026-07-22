import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/tests/mocks/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Rules tests need the Firestore emulator and run via `npm run test:rules`.
    // Left in the default suite they would fail on any machine without it,
    // making a green `npm test` impossible to rely on.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/rules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/logic.ts', 'src/features/**/schema.ts'],
    },
  },
});
