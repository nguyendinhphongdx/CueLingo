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
    // Site isolation as in desktop Chrome; Playwright's Chromium starts without it, which puts the sandbox frame in
    // the host's process and lets a looping block freeze the host page (assistant-sandbox.spec.ts, AC8).
    launchOptions: { args: ['--site-per-process'] },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Sandbox runner (ADR 0019): a static server on its own origin, embeddable by the web origin only.
      command: 'node infra/sandbox-runner/server.mjs',
      cwd: '..',
      url: 'http://localhost:3101/healthz',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        PORT: '3101',
        RUNNER_FRAME_ANCESTORS: `http://localhost:${WEB_PORT} http://localhost:3418`,
      },
    },
    {
      // Bare host page for the escape attempts in assistant-sandbox.spec.ts.
      command: 'node e2e/sandbox-host.mjs',
      cwd: '..',
      url: 'http://localhost:3418/healthz',
      reuseExistingServer: false,
      timeout: 30_000,
    },
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
