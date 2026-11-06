import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{apps,services,packages}/**/*.test.{ts,tsx}', 'infra/sandbox-runner/**/*.test.mjs'],
    // Integration tests need Docker: run them with `pnpm test:int`.
    exclude: ['**/node_modules/**', '**/*.int.test.ts', '.worktrees/**'],
    passWithNoTests: false,
  },
});
