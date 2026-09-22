import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { dashboardMobileRowNames, installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

/** Headless browsers have no collapsing address bar. Model its larger legacy
 * 100vh in the loaded CSS while leaving 100dvh at the visible viewport height.
 * This reproduces the production h-screen/h-dvh cascade without mocking layout. */
async function modelBrowserToolbar(page: Page) {
  await page.evaluate(() => {
    const visit = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule) {
          const height = rule.style.getPropertyValue('height');
          if (/\b100vh\b/.test(height)) {
            rule.style.setProperty('height', height.replace(/\b100vh\b/g, 'calc(100dvh + 120px)'));
          }
        }
        if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try { visit(sheet.cssRules); } catch { /* Ignore cross-origin font CSS. */ }
    }
  });
}

async function expectCardBottomsAboveNavigation(page: Page, testInfo?: TestInfo) {
  const nav = page.locator('[data-mobile-bottom-nav]');
  const panel = page.locator('.dashboard-mobile-tabs > [role="tabpanel"][data-state="active"]');
  for (const name of ['Shoots', 'Completed', 'Assign', 'Requests', 'Pipeline']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(panel).toBeVisible();
    await expect.poll(async () => {
      const bottom = (await panel.boundingBox())!.y + (await panel.boundingBox())!.height;
      return bottom - (await nav.boundingBox())!.y;
    }, { message: `${name}: the active panel must end above the navigation` }).toBeLessThanOrEqual(1);

    const scrollingLists = panel.locator('.overflow-y-auto.hidden-scrollbar, .overflow-y-auto.custom-scrollbar');
    for (const list of await scrollingLists.all()) {
      if (!(await list.isVisible())) continue;
      if (name === 'Shoots') {
        await expect.poll(async () => {
          await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
          return panel.getByRole('heading', { name: dashboardMobileRowNames.lastShoot, exact: true }).count();
        }, { message: 'Scrolling must load every upcoming shoot' }).toBe(1);
      }
      await expect.poll(async () => list.evaluate(async el => {
        el.scrollTop = el.scrollHeight;
        await new Promise(resolve => requestAnimationFrame(resolve));
        return el.scrollHeight - el.scrollTop - el.clientHeight;
      })).toBeLessThanOrEqual(1);
      const metrics = await list.evaluate(el => ({
        bottom: el.getBoundingClientRect().bottom,
        remaining: el.scrollHeight - el.scrollTop - el.clientHeight,
        height: el.clientHeight,
      }));
      expect(metrics.height, `${name}: the list must retain visible space`).toBeGreaterThan(0);
      expect(metrics.remaining, `${name}: the list must reach its end`).toBeLessThanOrEqual(1);
      expect(metrics.bottom, `${name}: the list end must clear the navigation`).toBeLessThanOrEqual((await nav.boundingBox())!.y + 1);
    }

    if (name === 'Shoots' || name === 'Assign') {
      const lastRow = name === 'Shoots'
        ? panel.getByRole('heading', { name: dashboardMobileRowNames.lastShoot, exact: true })
        : panel.getByText(dashboardMobileRowNames.lastPhotographer, { exact: true });
      await expect(lastRow).toBeInViewport({ ratio: 1 });
      await lastRow.click({ trial: true });
    }

    const footer = name === 'Assign'
      ? panel.getByRole('button', { name: 'View full schedule' })
      : name === 'Completed' ? panel.getByRole('button', { name: /View all/i }) : null;
    if (footer) {
      await expect(footer).toBeInViewport({ ratio: 1 });
      await footer.click({ trial: true });
      const box = (await footer.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual((await nav.boundingBox())!.y);
    }
    if (testInfo) await page.screenshot({ path: testInfo.outputPath(`mobile-${name.toLowerCase()}-bottom.png`) });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
}

const browserName = process.env.E2E_BROWSER === 'webkit' ? 'webkit' : 'chromium';
test.use({
  browserName, viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, video: 'off',
  ...(browserName === 'chromium' && process.env.E2E_CHROME_CHANNEL ? { channel: process.env.E2E_CHROME_CHANNEL } : {}),
});
test.describe(`${browserName} mobile dashboard`, () => {

    test('keeps every tab bottom reachable when browser toolbars resize the viewport', async ({ page, baseURL }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await installDashboardMobileFixtures(page, baseURL);
      await page.goto('/dashboard');
      await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
      await expect(page.locator('[data-mobile-bottom-nav]')).toBeVisible();
      await modelBrowserToolbar(page);
      await expectCardBottomsAboveNavigation(page, testInfo);

      // Expanded viewport, narrow phone, and tablet compact shell.
      for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }, { width: 820, height: 1180 }]) {
        await page.setViewportSize(viewport);
        await expectCardBottomsAboveNavigation(page);
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.locator('[data-mobile-bottom-nav]')).toHaveCount(0);
      expect(await page.locator('.dashboard-viewport').evaluate(el => el.getBoundingClientRect().bottom)).toBe(900);
      await page.screenshot({ path: testInfo.outputPath('desktop.png') });
      expect(errors).toEqual([]);
    });
});
