import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

test.use({ isMobile: true, hasTouch: true, video: 'off' });

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [width, height, channel, destination] of [
    [360, 640, 'Emails', '/messaging/email/inbox'],
    [390, 844, 'SMS', '/messaging/sms'],
    [820, 1180, 'Calls', '/calls'],
  ] as const) {
    test(`${colorScheme} ${width}px: separate channel counts and direct ${channel} navigation`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await installDashboardMobileFixtures(page, baseURL, 'admin', true);
      await page.addInitScript(theme => localStorage.setItem('theme', theme), colorScheme);
      const resources = [
        'dashboard', 'dashboard-admin', 'dashboard-availability', 'dashboard-editing-requests',
        'dashboard-contact-actions', 'shoots', 'shoot-history', 'availability', 'book-shoot',
        'accounting', 'invoices', 'accounts', 'ai-editing', 'robbie', 'scheduling-settings',
        'portal', 'messaging-email', 'messaging-overview', 'messaging-sms', 'voice-calls', 'support', 'settings',
      ];
      await page.route('**/api/me/permissions', route => route.fulfill({ json: {
        permissionIds: resources.map(resource => `${resource}:view`),
        permissions: resources.map(resource => ({ resource, action: 'view' })).concat([{ resource: 'book-shoot', action: 'create' }]),
      } }));
      await page.route('**/api/messaging/badge-counts', route => route.fulfill({ json: { email: 12, sms: 7, call: 3, total: 22 } }));
      await page.goto('/dashboard');
      await page.getByRole('button', { name: 'More', exact: true }).click();

      for (const [label, count, href] of [
        ['Emails', 12, '/messaging/email/inbox'], ['SMS', 7, '/messaging/sms'], ['Calls', 3, '/calls'],
      ] as const) {
        const link = page.getByRole('link', { name: `${label}, ${count} unread`, exact: true });
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toContainText(String(count));
        await link.scrollIntoViewIfNeeded();
        await expect(link).toBeInViewport();
        const bounds = await link.boundingBox();
        expect(bounds?.width).toBeGreaterThan(44);
        expect(bounds?.height).toBeGreaterThanOrEqual(78);
      }
      await expect(page.getByRole('link', { name: /Messaging|Overview/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Toggle submenu' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

      await page.getByRole('link', { name: 'SMS, 7 unread', exact: true }).scrollIntoViewIfNeeded();
      if (process.env.E2E_EVIDENCE_DIR) {
        await mkdir(process.env.E2E_EVIDENCE_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.E2E_EVIDENCE_DIR, `mobile-menu-${width}-${colorScheme}.png`) });
      }

      await page.getByRole('link', { name: new RegExp(`^${channel},`) }).click();
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
      await expect(page.getByRole('link', { name: 'Old Dashboard', exact: true })).toHaveCount(0);
    });
  }
}
