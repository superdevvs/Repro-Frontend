import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Dashboard frontend end-to-end suite.
 *
 * Runs HEADLESS by default (no headed/live display required) so the suite works in
 * CI/sandbox environments. The e2e specs live under `e2e/` (kept separate from the
 * Vitest unit/property tests under `src/**`, which Vitest matches via `*.{test,spec}.tsx`).
 *
 * Environment variables:
 *   E2E_BASE_URL  — base URL of an already-running Dashboard (default http://localhost:5173).
 *                   When set, Playwright reuses that server and does NOT start its own.
 *   E2E_NO_SERVER — set to "1" to disable the managed dev server entirely (point at a
 *                   fully external stack via E2E_BASE_URL).
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — admin credentials used by the login step.
 *
 * The managed `webServer` below starts the Vite dev server (`npm run dev`), which proxies
 * `/api` to the Laravel backend on http://127.0.0.1:8000. The backend (with seeded admin +
 * photographer + service-area data) must be running separately for the suite to pass.
 */

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const useManagedServer = process.env.E2E_NO_SERVER !== '1' && !process.env.E2E_BASE_URL;
const storageState = process.env.E2E_PREVIEW_STORAGE_STATE || undefined;

export default defineConfig({
  testDir: './e2e',
  // Avoid colliding with Vitest's src/**/*.spec.tsx files.
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    headless: true,
    // Honor a dark-mode request via env (sets prefers-color-scheme: dark for the browser context).
    colorScheme: process.env.E2E_COLOR_SCHEME === 'dark' ? 'dark' : undefined,
    storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(useManagedServer
    ? {
        webServer: {
          command: 'npm run dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
