import { expect, test } from '@playwright/test';
import { installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

test.use({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, video: 'off',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
});

test('mobile install suggestion expires 30 seconds after sign-in', async ({ page, baseURL }) => {
  await installDashboardMobileFixtures(page, baseURL, 'admin', true);
  await page.clock.install();
  await page.goto('/dashboard');
  await expect(page.getByRole('main')).toBeVisible();
  const banner = page.getByRole('complementary', { name: 'Add dashboard to Home Screen' });
  await expect(banner).toHaveCount(0);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  // AuthProvider integration tests cover starting this marker on real login.
  // This local browser fixture checks its timing in the full dashboard shell.
  await page.evaluate(() => {
    localStorage.setItem('repro.home-screen-prompt.login-deadline', String(Date.now() + 30_000));
    window.dispatchEvent(new StorageEvent('storage', { key: 'repro.home-screen-prompt.login-deadline' }));
  });
  await expect(banner).toBeVisible();
  await page.clock.fastForward(29_999);
  await expect(banner).toBeVisible();
  await page.clock.fastForward(1);
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
});
