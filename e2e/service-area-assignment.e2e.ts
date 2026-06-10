import { expect, test, type Request } from '@playwright/test';

import { loginAsAdmin } from './helpers/auth';

/**
 * End-to-end check for the photographer Service-Area Assignment_Tool (Requirement 10.6).
 *
 * Covers the full filter → preview → commit flow against a real browser:
 *   1. Filter photographers by a service-area (kind, value).
 *   2. "Preview matches" renders the matching photographers and persists NOTHING
 *      (asserts a preview request fired and NO commit request fired) — AC 10.3, 10.5.
 *   3. "Confirm assignment" commits, the assignment is persisted, and the committed
 *      photographer is reflected in the refreshed match list — AC 10.4.
 *
 * Filter values are configurable via env so the spec adapts to the seeded data set:
 *   E2E_FILTER_KIND  (default "state")
 *   E2E_FILTER_VALUE (default "MD")
 */

const FILTER_KIND = process.env.E2E_FILTER_KIND ?? 'state';
const FILTER_VALUE = process.env.E2E_FILTER_VALUE ?? 'MD';

const KIND_LABELS: Record<string, string> = {
  region: 'Region',
  state: 'State',
  area: 'Area',
};

const PREVIEW_URL = /\/admin\/assignments\/preview/;
const COMMIT_URL = /\/admin\/assignments\/commit/;

test.describe('Service-Area Assignment Tool (Req 10.6)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/service-areas');
    await expect(
      page.getByTestId('service-area-assignment-tool'),
    ).toBeVisible();
  });

  test('filters, previews without persisting, then commits an assignment', async ({ page }) => {
    // --- Filter: choose (kind, value) -------------------------------------------------
    // Radix Select trigger for "Kind".
    await page.locator('#service-area-kind').click();
    await page
      .getByRole('option', { name: KIND_LABELS[FILTER_KIND] ?? 'State' })
      .click();

    await page.locator('#service-area-value').fill(FILTER_VALUE);

    // Track network so we can prove preview persists nothing (AC 10.5).
    const commitRequests: Request[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && COMMIT_URL.test(request.url())) {
        commitRequests.push(request);
      }
    });

    // --- Preview matches (no write) ---------------------------------------------------
    const previewResponsePromise = page.waitForResponse(
      (res) => PREVIEW_URL.test(res.url()) && res.request().method() === 'POST',
    );
    await page.getByTestId('service-area-preview-button').click();
    const previewResponse = await previewResponsePromise;
    expect(previewResponse.ok()).toBeTruthy();

    // The matches card renders (AC 10.3).
    await expect(page.getByTestId('service-area-matches-card')).toBeVisible();

    // Preview must NOT have triggered any commit (AC 10.5 — preview persists nothing).
    expect(commitRequests).toHaveLength(0);

    // --- Select a photographer and commit ---------------------------------------------
    await page.locator('#service-area-photographer').click();
    const firstOption = page.getByRole('option').first();
    await expect(firstOption).toBeVisible();
    const committedPhotographer = (await firstOption.textContent())?.trim() ?? '';
    await firstOption.click();

    const commitResponsePromise = page.waitForResponse(
      (res) => COMMIT_URL.test(res.url()) && res.request().method() === 'POST',
    );
    await page.getByTestId('service-area-commit-button').click();
    const commitResponse = await commitResponsePromise;
    expect(commitResponse.ok()).toBeTruthy();

    // Success is surfaced to the admin (AC 10.4).
    await expect(page.getByText('Service area assigned')).toBeVisible();

    // The committed assignment is reflected in the refreshed match list (persisted, AC 10.4).
    // The photographer option label is "Name — email"; assert the name portion appears.
    const committedName = committedPhotographer.split('—')[0]?.trim();
    if (committedName) {
      await expect(
        page.getByTestId('service-area-matches-list').getByText(committedName, { exact: false }),
      ).toBeVisible();
    }
  });
});
