import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/auth';

/**
 * Shoot-event SMS — live send driver.
 *
 * Logs in through the real Dashboard login form, opens Messaging Settings → SMS (Telnyx),
 * and drives the "Test Send" dialog once per target number, sending a shoot-event style
 * message through the real UI → API → Telnyx path.
 *
 * SAFETY GATE: actual delivery only happens when E2E_LIVE_SMS=1. Without the flag the test
 * opens the dialog and fills the fields but stops short of clicking "Send Test SMS", so the
 * suite can run in CI without spending money or texting real phones.
 *
 * Credentials default to the seeded e2e admin; override via E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD.
 */

const LIVE = process.env.E2E_LIVE_SMS === '1';

// Real destinations supplied for this run.
const NUMBERS = ['301-310-1280', '240-620-3790', '301-637-5700'];

// A shoot-event style notification kept short (the dialog message field is a single-line input).
const message = (to: string) =>
  `RePro shoot-event test: your shoot is confirmed. (e2e ${to} ${new Date().toISOString().slice(11, 19)})`;

test.describe('Shoot-event SMS — Test Send', () => {
  test('sends a shoot-event SMS to each target number', async ({ page }) => {
    test.setTimeout(120_000);

    await loginAsAdmin(page);

    await page.goto('/messaging/settings');

    // Switch to the SMS (Telnyx) tab.
    await page.getByRole('tab', { name: 'SMS (Telnyx)' }).click();

    // The "Test Send" trigger is disabled until a configured sender loads.
    const testSendTrigger = page.getByRole('button', { name: 'Test Send' });
    await expect(testSendTrigger).toBeEnabled({ timeout: 15_000 });

    for (const number of NUMBERS) {
      await testSendTrigger.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Send Test SMS' })).toBeVisible();

      await dialog.getByPlaceholder('+1 (555) 123-4567').fill(number);
      await dialog.getByPlaceholder('Test message').fill(message(number));

      if (!LIVE) {
        // Dry-run: confirm the flow is wired up, then close without sending.
        await expect(dialog.getByRole('button', { name: 'Send Test SMS' })).toBeEnabled();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        continue;
      }

      await dialog.getByRole('button', { name: 'Send Test SMS' }).click();

      // On success the page shows a toast "Test SMS sent! Message ID: ..." and closes the dialog.
      // Target the newest toast (.last()) since sonner toasts can briefly stack.
      await expect(page.getByText(/Test SMS sent! Message ID:/i).last()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

      // Wait for all success toasts to auto-dismiss so the next iteration verifies its own send
      // rather than matching a stale toast from the previous number.
      await expect(page.getByText(/Test SMS sent! Message ID:/i)).toHaveCount(0, { timeout: 20_000 });
    }
  });
});
