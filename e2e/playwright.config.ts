import { defineConfig } from '@playwright/test';

const API_PORT = 4417;
const WEB_PORT = 3417;
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5544/cuelingo_e2e';

/**
 * End-to-end journey on the web app against a real API and Postgres (docs: P2-21).
 * Needs a database that is migrated (`pnpm e2e:db`); the servers start themselves.
 * `E2E_CHROME=0` uses Playwright's own Chromium (CI); by default the Chrome installed on the machine.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: process.env.E2E_CHROME === '0' ? undefined : 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/start-api.mjs',
      cwd: '..',
      url: `http://localhost:${API_PORT}/healthz`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_URL,
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        BETTER_AUTH_URL: `http://localhost:${API_PORT}`,
        BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123',
        MAIL_PROVIDER: 'console',
      },
    },
    {
      command: 'pnpm --filter @cuelingo/web exec next dev --webpack --port ' + WEB_PORT,
      cwd: '..',
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
