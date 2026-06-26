import { mkdir } from 'node:fs/promises';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { loginAsAdmin, loginAsEditor } from '../helpers/auth';

/**
 * LIVE, HEADED read-only demo of the photographer onboarding QA suite.
 *
 * This spec is meant to be WATCHED: run it with `--headed` (and optional slowMo) against a local
 * stack so a real Chromium window opens and drives the app as admin, photographer, and client in
 * three independent browser contexts held open simultaneously (Requirement 15 in miniature).
 *
 * It is strictly READ-ONLY: it logs in and navigates onboarding surfaces, capturing a screenshot of
 * each. It performs NO bookings, charges, uploads, or messages — safe to run against a stack whose
 * .env carries live provider keys.
 *
 * Run (from frontend/):
 *   $env:E2E_BASE_URL="http://localhost:5173"; $env:E2E_API_BASE_URL="http://127.0.0.1:8000";
 *   $env:E2E_ADMIN_EMAIL="qa.admin@example.test"; $env:E2E_ADMIN_PASSWORD="QaDemo123!";
 *   npx playwright test onboarding/live-demo --headed --project=chromium
 */

// Slow the actions down so the window is comfortably watchable.
test.use({ launchOptions: { slowMo: 500 } });

const OUTPUT_DIR = '../output/playwright';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'qa.admin@example.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'QaDemo123!';
const PHOTOG_EMAIL = process.env.E2E_PHOTOG_EMAIL ?? 'test.photographer@example.com';
const PHOTOG_PASSWORD = process.env.E2E_PHOTOG_PASSWORD ?? 'QaDemo123!';
const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL ?? 'test.client@example.com';
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD ?? 'QaDemo123!';

/** Navigate to a route, settle, pause so it is visible, and screenshot it. Never throws. */
async function visit(page: Page, role: string, route: string, label: string): Promise<string> {
  const shot = `${OUTPUT_DIR}/live-${role}-${label}.png`;
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForTimeout(1_500); // dwell so a human watching can see the surface
    await page.screenshot({ path: shot, fullPage: true });
    // eslint-disable-next-line no-console
    console.log(`  [${role}] ${route} -> ${shot}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`  [${role}] ${route} not reachable: ${(error as Error).message}`);
  }
  return shot;
}

test('LIVE headed onboarding walkthrough — admin + photographer + client (read-only)', async ({ browser }) => {
  test.setTimeout(180_000);
  await mkdir(OUTPUT_DIR, { recursive: true }).catch(() => undefined);

  const contexts: BrowserContext[] = [];
  const open = async (): Promise<Page> => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(ctx);
    return ctx.newPage();
  };

  try {
    // ── Admin context ───────────────────────────────────────────────────────────────────────
    const adminPage = await open();
    // eslint-disable-next-line no-console
    console.log(`[admin] logging in as ${ADMIN_EMAIL}`);
    await loginAsAdmin(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(adminPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    for (const [route, label] of [
      ['/dashboard', 'dashboard'],
      ['/admin/photographers', 'photographers'],
      ['/admin/service-areas', 'service-areas'],
      ['/shoot-history', 'shoots'],
      ['/settings', 'settings'],
    ] as const) {
      await visit(adminPage, 'admin', route, label);
    }

    // ── Photographer context (held open at the same time) ─────────────────────────────────────
    const photogPage = await open();
    // eslint-disable-next-line no-console
    console.log(`[photographer] logging in as ${PHOTOG_EMAIL}`);
    await loginAsEditor(photogPage, PHOTOG_EMAIL, PHOTOG_PASSWORD);
    await expect(photogPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    for (const [route, label] of [
      ['/dashboard', 'dashboard'],
      ['/shoot-history', 'my-shoots'],
      ['/profile', 'profile'],
      ['/settings', 'settings'],
    ] as const) {
      await visit(photogPage, 'photographer', route, label);
    }

    // ── Client context (held open at the same time) ───────────────────────────────────────────
    const clientPage = await open();
    // eslint-disable-next-line no-console
    console.log(`[client] logging in as ${CLIENT_EMAIL}`);
    await loginAsEditor(clientPage, CLIENT_EMAIL, CLIENT_PASSWORD);
    await expect(clientPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    for (const [route, label] of [
      ['/dashboard', 'dashboard'],
      ['/book', 'book'],
      ['/book-shoot', 'book-shoot'],
    ] as const) {
      await visit(clientPage, 'client', route, label);
    }

    // All three contexts authenticated independently and simultaneously.
    expect(contexts.length).toBe(3);
    // eslint-disable-next-line no-console
    console.log('[demo] admin + photographer + client sessions held open simultaneously — read-only walkthrough complete.');

    // Final dwell so the three windows are visible together before teardown.
    await adminPage.waitForTimeout(2_000);
  } finally {
    await Promise.all(contexts.map((c) => c.close().catch(() => undefined)));
  }
});
