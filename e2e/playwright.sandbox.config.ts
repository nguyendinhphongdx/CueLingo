import { defineConfig } from '@playwright/test';

const HOST_ORIGIN = 'http://localhost:3418';

/**
 * Only the sandbox escape attempts (`assistant-sandbox.spec.ts`): they need the runner and a browser, no database,
 * API or web server. Run with `pnpm --filter @cuelingo/e2e e2e:sandbox`. `E2E_CHROME=0` uses Playwright's own Chromium.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: 'assistant-sandbox.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: 'list',
  use: {
    channel: process.env.E2E_CHROME === '0' ? undefined : 'chrome',
    // Site isolation as in desktop Chrome; Playwright's Chromium starts without it, which puts the sandbox frame in
    // the host's process and lets a looping block freeze the host page (assistant-sandbox.spec.ts, AC8).
    launchOptions: { args: ['--site-per-process'] },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node infra/sandbox-runner/server.mjs',
      cwd: '..',
      url: 'http://localhost:3101/healthz',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { PORT: '3101', RUNNER_FRAME_ANCESTORS: HOST_ORIGIN },
    },
    {
      command: 'node e2e/sandbox-host.mjs',
      cwd: '..',
      url: 'http://localhost:3418/healthz',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
