import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/auth';

const SHOOT_ID = (process.env.E2E_LINK_ONLY_SHOOT_ID ?? '').trim();
const CONFIRMED = process.env.E2E_CONFIRM_DESTRUCTIVE === '1';
const VIDEO_URL =
  process.env.E2E_LINK_ONLY_VIDEO_URL ??
  `https://video.example.test/e2e/${SHOOT_ID || 'shoot'}`;

test.describe('Admin link-only shoot finalisation', () => {
  test('saves a video link and delivers a zero-upload eligible shoot', async ({ page }) => {
    test.skip(
      !SHOOT_ID || !CONFIRMED,
      'Set E2E_LINK_ONLY_SHOOT_ID to an eligible zero-upload fixture and E2E_CONFIRM_DESTRUCTIVE=1.',
    );

    await loginAsAdmin(page);
    await page.goto(`/shoots/${SHOOT_ID}`);

    await page.getByRole('button', { name: 'Tour', exact: true }).click();
    await page.getByTitle('Edit video embed').click();
    await page
      .getByPlaceholder('https://www.youtube.com/watch?v=... or https://vimeo.com/...')
      .last()
      .fill(VIDEO_URL);
    await page.getByRole('button', { name: 'Save', exact: true }).last().click();

    await expect(page.getByText('Video link saved successfully')).toBeVisible();
    const finalizeButton = page.getByRole('button', { name: /Finalize \(fast-forward\)/i });
    await expect(finalizeButton).toBeVisible();

    const finalizeRequestPromise = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      request.url().endsWith(`/api/shoots/${SHOOT_ID}/finalize`),
    );
    await finalizeButton.click();

    const finalizeRequest = await finalizeRequestPromise;
    expect(finalizeRequest.postDataJSON()).toMatchObject({
      allow_no_media_delivery: true,
    });

    const token = await page.evaluate(
      () => localStorage.getItem('authToken') || localStorage.getItem('token'),
    );
    expect(token).toBeTruthy();

    await expect.poll(async () => {
      const response = await page.request.get(`/api/shoots/${SHOOT_ID}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok()) return `http-${response.status()}`;

      const body = await response.json();
      return String(
        body?.data?.workflow_status ??
        body?.data?.workflowStatus ??
        body?.data?.status ??
        '',
      ).toLowerCase();
    }, {
      message: 'The queued link-only delivery should reach Delivered',
      timeout: 60_000,
    }).toBe('delivered');
  });
});
