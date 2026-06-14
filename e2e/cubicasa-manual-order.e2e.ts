import { expect, test, type Page } from '@playwright/test';

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  PHOTO_EDITOR_EMAIL,
  PHOTO_EDITOR_PASSWORD,
  loginAsAdmin,
  loginAsEditor,
} from './helpers/auth';

/**
 * QA #17 — Admin manual "Create/Retry CubiCasa order" button.
 *
 * The backend endpoint (POST /api/integrations/shoots/{id}/cubicasa/order) and the
 * button component already exist; the button lives on the shoot's **Tour** tab and is
 * admin-gated. The QA "no button" finding came from checking Overview/Settings instead
 * of Tour. This spec confirms the existing control:
 *   17a  An admin sees the Create/Sync CubiCasa order button on a floor-plan shoot's
 *        Tour tab.
 *   17b  A non-admin (editor) does NOT see it.
 *
 * ENVIRONMENT — needs the full seeded stack and a CubiCasa-eligible shoot:
 *   • E2E_CUBICASA_SHOOT_ID — a shoot with a Floor Plans / 3D service.
 *   When unset the spec skips (it must not be faked).
 *
 * Runs HEADLESS. Targets real routes/controls so a green run is a genuine verification.
 */

const CUBICASA_SHOOT_ID = process.env.E2E_CUBICASA_SHOOT_ID ?? '';

async function openTourTab(page: Page, shootId: string) {
  await page.goto(`/shoots/${shootId}`);
  await expect(page).toHaveURL(/\/shoots\//);
  const tourTab = page.getByRole('tab', { name: /tour/i }).first();
  await expect(tourTab).toBeVisible({ timeout: 15_000 });
  await tourTab.click();
}

test.describe('QA #17 — manual CubiCasa order button', () => {
  test('17a — admin sees the Create/Sync CubiCasa order button on the Tour tab', async ({
    page,
  }) => {
    test.skip(!CUBICASA_SHOOT_ID, 'Set E2E_CUBICASA_SHOOT_ID to a floor-plan shoot.');

    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await openTourTab(page, CUBICASA_SHOOT_ID);

    await expect(
      page.getByTestId('create-cubicasa-order-button'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('17b — a non-admin editor does NOT see the CubiCasa order button', async ({ page }) => {
    test.skip(!CUBICASA_SHOOT_ID, 'Set E2E_CUBICASA_SHOOT_ID to a floor-plan shoot.');

    await loginAsEditor(page, PHOTO_EDITOR_EMAIL, PHOTO_EDITOR_PASSWORD);
    await page.goto(`/shoots/${CUBICASA_SHOOT_ID}`);

    // Either the editor cannot open the Tour tab, or it renders without the admin button.
    const tourTab = page.getByRole('tab', { name: /tour/i }).first();
    if (await tourTab.isVisible().catch(() => false)) {
      await tourTab.click();
    }

    await expect(page.getByTestId('create-cubicasa-order-button')).toHaveCount(0);
  });
});
