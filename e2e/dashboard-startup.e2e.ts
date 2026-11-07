import { expect, test, type Page } from '@playwright/test';
import { dashboardMobileRowNames, installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

async function holdRequest(page: Page, url: RegExp) {
  let requested = false;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(url, async route => {
    requested = true;
    await gate;
    await route.fallback();
  });
  return { requested: () => requested, release };
}

test('keeps the original branded preloader until the dashboard can render', async ({ page, baseURL }) => {
  await installDashboardMobileFixtures(page, baseURL, 'admin', true);
  const app = await holdRequest(page, /\/(?:assets\/App-[^/?]+\.js|src\/App\.tsx)(?:\?|$)/);
  const overview = await holdRequest(page, /\/api\/dashboard\/overview(?:\?|$)/);
  const card = await holdRequest(page, /\/(?:assets\/AssignPhotographersCard-[^/?]+\.js|src\/components\/dashboard\/v2\/AssignPhotographersCard\.tsx)(?:\?|$)/);
  const preloader = page.getByRole('status', { name: 'Loading R/E Pro Photos' });
  const upcoming = page.getByRole('heading', { name: dashboardMobileRowNames.firstShoot, exact: true });

  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect.poll(app.requested, { timeout: 30_000 }).toBe(true);
    await expect(page.locator('[data-app-preloader]')).toBeAttached();
    await expect(preloader).toBeVisible();
    await expect.poll(() => preloader.locator('img').evaluate((logo: HTMLImageElement) => logo.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
    const originalPreloader = await preloader.elementHandle();

    app.release();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect.poll(overview.requested).toBe(true);
    await expect.poll(card.requested).toBe(true);
    await expect(preloader).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log In' })).toHaveCount(0);
    await expect(upcoming).toBeHidden();

    overview.release();
    await expect(page.getByText(dashboardMobileRowNames.firstShoot, { exact: true }).first()).toBeAttached();
    await expect(preloader).toBeVisible();
    await expect(upcoming).toBeHidden();
    expect(await originalPreloader?.evaluate(node => node.isConnected)).toBe(true);

    card.release();
    await expect(upcoming).toBeVisible();
    await expect(preloader).toBeHidden();

    const refresh = await holdRequest(page, /\/api\/client-requests(?:\?|$)/);
    try {
      await page.evaluate(() => window.dispatchEvent(new Event('shoot-request-updated')));
      await expect.poll(refresh.requested).toBe(true);
      await expect(preloader).toBeHidden();
      await expect(upcoming).toBeVisible();
    } finally {
      refresh.release();
    }
  } finally {
    app.release();
    overview.release();
    card.release();
  }
});

test('reveals the dashboard retry action when the initial overview fails', async ({ page, baseURL }) => {
  await installDashboardMobileFixtures(page, baseURL, 'admin', true);
  let failOverview = true;
  await page.route(/\/api\/dashboard\/overview(?:\?|$)/, route => failOverview
    ? route.fulfill({ status: 503, body: 'Service unavailable' })
    : route.fallback());

  await page.goto('/dashboard');
  await expect(page.getByText('Error loading dashboard:', { exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading R/E Pro Photos' })).toBeHidden();

  failOverview = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Error loading dashboard:', { exact: true })).toBeHidden();
});
