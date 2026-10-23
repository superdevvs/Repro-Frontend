import { expect, test } from '@playwright/test';
import path from 'node:path';
import { dashboardMobileRowNames, installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, video: 'off', trace: 'off', screenshot: 'off' });

for (const hasTouch of [false, true]) {
  test.describe(hasTouch ? 'touchscreen' : 'mouse and trackpad', () => {
    test.use({ hasTouch });
    test('keeps the open shoot and selected tab when resizing the dashboard', async ({ page, baseURL }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await page.routeWebSocket(url => !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), socket => socket.close());
      const fixture = await installDashboardMobileFixtures(page, baseURL, 'admin', true);
      await page.goto('/dashboard');
      await page.getByText(dashboardMobileRowNames.firstShoot, { exact: true }).filter({ visible: true }).first().click();
      const dialog = page.getByRole('dialog', { name: `#920001 · ${dashboardMobileRowNames.firstShoot}`, exact: true });
      await expect(dialog).toBeVisible();
      const sections = dialog.getByRole('tablist', { name: 'Shoot sections', exact: true }).filter({ visible: true });
      for (const width of [1180, 1025, 1024, 1023, 820, 390, 1440, 820]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(dialog).toBeVisible();
        await expect(sections.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
        await expect(dialog.getByRole('region', { name: 'Booked services', exact: true })).toBeVisible();
      }
      if (process.env.E2E_SHOOT_SCREENSHOT_DIR) {
        await page.screenshot({ path: path.join(process.env.E2E_SHOOT_SCREENSHOT_DIR, `dashboard-overview-resized-${hasTouch ? 'touch' : 'mouse'}-820.png`) });
      }
      await sections.getByRole('tab', { name: 'Notes', exact: true }).click();
      for (const width of [1440, 820]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(dialog).toBeVisible();
        await expect(sections.getByRole('tab', { name: 'Notes', exact: true })).toHaveAttribute('aria-selected', 'true');
      }
      await dialog.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true }).click();
      await expect(dialog).toBeHidden();
      expect(fixture.requests.filter(request => request.method !== 'GET' && /^\/(shoots|invoices|notifications|messaging)\b/.test(request.path))).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
