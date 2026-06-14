import { expect, test } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './helpers/auth';

/**
 * QA #18 — Mobile landscape scroll on Shoot History.
 *
 * At landscape mobile dimensions (e.g. 844×390) the page previously could not scroll:
 * `html/body` are overflow:hidden and the shell used `h-screen` (100vh), which
 * over-reports on mobile landscape, leaving the single `<main>` scroll container too
 * short to reach the (~3500px) content below the fold.
 *
 * With the fix (`h-dvh` shell + un-clamped shoot-history tab content + touch overscroll)
 * the `<main>` container must be scrollable: scrolling to the bottom must move scrollTop
 * and reveal content that starts off-screen.
 *
 * Runs HEADLESS at a landscape mobile viewport. Targets the real route so a green run
 * is a genuine verification.
 */

// Pixel 5 / iPhone-class landscape footprint used by the QA finding.
test.use({ viewport: { width: 844, height: 390 } });

test.describe('QA #18 — Shoot History scrolls in mobile landscape', () => {
  test('the main content area can scroll to the bottom in landscape', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto('/shoot-history');
    await expect(page).toHaveURL(/\/shoot-history/);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const main = page.locator('main').first();
    await expect(main).toBeVisible();

    // The content must overflow the visible main area (otherwise there is nothing to
    // scroll and the test is not meaningful for this viewport/data set).
    const metrics = await main.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    test.skip(
      metrics.scrollHeight <= metrics.clientHeight + 8,
      'Shoot History content does not overflow at this viewport/seed; nothing to scroll.',
    );

    // Drive a real scroll on the main container and assert it actually moved.
    await main.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await page.waitForTimeout(300);

    const scrolledTop = await main.evaluate((el) => el.scrollTop);
    expect(
      scrolledTop,
      'main must scroll down in landscape (scrollTop should advance past 0)',
    ).toBeGreaterThan(0);

    // And we should be able to reach (near) the bottom.
    const reachedBottom = await main.evaluate(
      (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 24,
    );
    expect(reachedBottom, 'main must be able to reach the bottom of the content').toBe(true);
  });
});
