import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/auth';

const SHOOT_ID = (process.env.E2E_SERVICE_REMOVAL_SHOOT_ID ?? '').trim();
const CONFIRMED = process.env.E2E_CONFIRM_DESTRUCTIVE === '1';
const VIDEO_URL = process.env.E2E_LINK_ONLY_VIDEO_URL
  ?? `https://video.example.test/e2e/service-removal-${SHOOT_ID || 'shoot'}`;

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const numberValue = (...values: unknown[]): number => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

test.describe('Admin zero-service pricing and link-only delivery', () => {
  test('removes two services, restores canonical pricing, then delivers link-only', async ({ page }) => {
    test.skip(
      !SHOOT_ID || !CONFIRMED,
      'Set E2E_SERVICE_REMOVAL_SHOOT_ID to a pre-delivery two-service fixture and E2E_CONFIRM_DESTRUCTIVE=1.',
    );

    await loginAsAdmin(page);
    const token = await page.evaluate(
      () => localStorage.getItem('authToken') || localStorage.getItem('token'),
    );
    expect(token).toBeTruthy();
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    const initialResponse = await page.request.get(`/api/shoots/${SHOOT_ID}`, { headers });
    expect(initialResponse.ok()).toBeTruthy();
    const initial = asRecord((await initialResponse.json()).data);
    const initialItems = Array.isArray(initial.serviceItems)
      ? initial.serviceItems.map(asRecord).filter((item) => !item.is_invoice_adjustment)
      : [];
    expect(initialItems.length).toBeGreaterThanOrEqual(2);
    const serviceToRestore = numberValue(initialItems[0]?.service_id, initialItems[0]?.serviceId);
    expect(serviceToRestore).toBeGreaterThan(0);

    const confirmationResponse = await page.request.patch(`/api/shoots/${SHOOT_ID}`, {
      headers,
      data: { services: [] },
    });
    expect(confirmationResponse.status()).toBe(409);
    const confirmation = asRecord(await confirmationResponse.json());
    const impact = asRecord(confirmation.impact);
    expect(Array.isArray(impact.removed_services) ? impact.removed_services.length : 0).toBeGreaterThanOrEqual(2);
    expect(impact.leaves_no_services).toBe(true);

    const emptyResponse = await page.request.patch(`/api/shoots/${SHOOT_ID}`, {
      headers,
      data: {
        services: [],
        confirm_service_detach: true,
        service_detach_confirmation_token: confirmation.confirmation_token,
      },
    });
    expect(emptyResponse.ok()).toBeTruthy();
    const emptyShoot = asRecord((await emptyResponse.json()).data);
    const adjustmentTotal = numberValue(emptyShoot.invoiceAdjustmentsTotal, emptyShoot.invoice_adjustments_total);
    expect(numberValue(emptyShoot.base_quote)).toBe(0);
    expect(numberValue(emptyShoot.discount_amount)).toBe(0);
    expect(numberValue(emptyShoot.tax_amount)).toBe(0);
    expect(numberValue(emptyShoot.total_quote)).toBeCloseTo(adjustmentTotal, 2);
    expect(emptyShoot.service_id ?? null).toBeNull();

    const restoredResponse = await page.request.patch(`/api/shoots/${SHOOT_ID}`, {
      headers,
      data: { services: [{ id: serviceToRestore }] },
    });
    expect(restoredResponse.ok()).toBeTruthy();
    const restored = asRecord((await restoredResponse.json()).data);
    const restoredItems = Array.isArray(restored.serviceItems)
      ? restored.serviceItems.map(asRecord).filter((item) => !item.is_invoice_adjustment)
      : [];
    expect(restoredItems).toHaveLength(1);
    expect(numberValue(restored.total_quote)).toBeCloseTo(
      numberValue(restored.base_quote) + numberValue(restored.tax_amount) + numberValue(
        restored.invoiceAdjustmentsTotal,
        restored.invoice_adjustments_total,
      ),
      2,
    );

    const finalRemovalPrompt = await page.request.patch(`/api/shoots/${SHOOT_ID}`, {
      headers,
      data: { services: [] },
    });
    expect(finalRemovalPrompt.status()).toBe(409);
    const finalConfirmation = asRecord(await finalRemovalPrompt.json());
    const finalEmptyResponse = await page.request.patch(`/api/shoots/${SHOOT_ID}`, {
      headers,
      data: {
        services: [],
        confirm_service_detach: true,
        service_detach_confirmation_token: finalConfirmation.confirmation_token,
      },
    });
    expect(finalEmptyResponse.ok()).toBeTruthy();

    await page.goto(`/shoots/${SHOOT_ID}`);
    await expect(page.getByText('No services', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Tour', exact: true }).click();
    await page.getByTitle('Edit video embed').click();
    await page
      .getByPlaceholder('https://www.youtube.com/watch?v=... or https://vimeo.com/...')
      .last()
      .fill(VIDEO_URL);
    await page.getByRole('button', { name: 'Save', exact: true }).last().click();
    await expect(page.getByText('Video link saved successfully')).toBeVisible();

    const finalizeButton = page.getByRole('button', { name: /Finalize \(fast-forward\)/i });
    const finalizeRequestPromise = page.waitForRequest((request) =>
      request.method() === 'POST' && request.url().endsWith(`/api/shoots/${SHOOT_ID}/finalize`),
    );
    await finalizeButton.click();
    expect((await finalizeRequestPromise).postDataJSON()).toMatchObject({
      allow_no_media_delivery: true,
    });

    await expect.poll(async () => {
      const response = await page.request.get(`/api/shoots/${SHOOT_ID}`, { headers });
      if (!response.ok()) return `http-${response.status()}`;
      const shoot = asRecord((await response.json()).data);
      return String(shoot.workflow_status ?? shoot.workflowStatus ?? shoot.status ?? '').toLowerCase();
    }, { timeout: 60_000 }).toBe('delivered');
  });
});
