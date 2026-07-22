import { defineConfig } from 'vitest/config';

/**
 * Firestore rules tests run against the emulator, so they are a separate
 * suite from the unit tests: they need `firebase emulators:exec` around them
 * and take seconds rather than milliseconds. `npm test` must stay fast enough
 * to run on every save, which it cannot if it boots an emulator.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // The emulator is a single shared resource; parallel files racing on the
    // same project ID produce flakes that look like rules bugs.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
