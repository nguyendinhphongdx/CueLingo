import { defineConfig } from 'vitest/config';

// Integration tests: real Postgres via Testcontainers. Slow to start, so one long timeout.
export default defineConfig({
  test: {
    include: ['{apps,services,packages}/**/*.int.test.ts'],
    exclude: ['**/node_modules/**', '.worktrees/**'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
