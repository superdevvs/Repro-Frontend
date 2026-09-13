import { expect, test, type Page } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './helpers/auth';

/**
 * Email Template Fixes — verifies the editor UX changes against the REAL
 * Messaging > Email > Templates UI:
 *   • System templates keep content editable (Subject is NOT disabled).
 *   • New Account body preview carries the new "Thank you for the opportunity." closing.
 *   • The protected-email override controls are present for EMAIL templates.
 *
 * The editor renders saved and draft content through the server's shared email
 * layout. The iframe preserves the delivered styles and supports both themes.
 *
 * ENVIRONMENT — needs the seeded stack + an admin account (E2E_ADMIN_EMAIL /
 * E2E_ADMIN_PASSWORD) with access to /messaging/email/templates. Runs headless and
 * skips gracefully when the templates UI or seeded rows are unavailable.
 */

async function openTemplateByName(page: Page, name: string): Promise<boolean> {
  await page.goto('/messaging/email/templates');
  if (!/\/messaging\/email\/templates/.test(page.url())) {
    return false; // No access / redirected.
  }

  const search = page.getByPlaceholder('Search templates...');
  if (!(await search.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false))) {
    return false;
  }

  await search.fill(name);
  const card = page.locator('h3', { hasText: name }).first();
  if (!(await card.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false))) {
    return false;
  }

  await card.click();
  // Editor dialog opens with the Email Subject field.
  await expect(page.getByLabel('Email Subject *')).toBeVisible({ timeout: 10_000 });
  return true;
}

test.describe('Email Template Fixes', () => {
  test('New Account: system template content is editable + new closing in preview', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const opened = await openTemplateByName(page, 'New Account Created');
    test.skip(!opened, 'Templates UI or "New Account Created" row unavailable; seed to verify.');

    // Editability: the subject (content field) must remain editable for system templates.
    const subject = page.getByLabel('Email Subject *');
    await expect(subject).toBeEnabled();

    // The protected-email override control is available for EMAIL templates.
    await expect(page.getByText('Automated email override')).toBeVisible();

    // Body preview carries the new closing line.
    await page.getByRole('tab', { name: /preview/i }).click();
    await expect(page.frameLocator('iframe[title="Delivered email preview"]').locator('[data-email-content="true"]').getByText('Thank you for the opportunity.', { exact: false })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Payment Reminder: system template subject remains editable', async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    const opened = await openTemplateByName(page, 'Payment Reminder');
    test.skip(!opened, 'Templates UI or "Payment Reminder" row unavailable; seed to verify.');

    await expect(page.getByLabel('Email Subject *')).toBeEnabled();
  });
});
