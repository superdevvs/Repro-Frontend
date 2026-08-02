import { expect, test } from '@playwright/test';

import { loginAsAdmin } from './helpers/auth';

test.describe('AI Editing Studio shell', () => {
  test('keeps one application sidebar and navigates from the workspace page buttons', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/ai-editing?d=command-center');

    await expect(page.getByTestId('application-sidebar')).toHaveCount(1);
    await expect(page.getByRole('tablist', { name: 'Studio media mode' })).toHaveCount(0);
    const pageNavigation = page.getByRole('navigation', { name: 'Studio pages' });
    await expect(pageNavigation).toBeVisible({ timeout: 30_000 });
    await expect(pageNavigation.getByRole('button')).toHaveCount(3);
    await expect(pageNavigation.getByRole('button', { name: /Studio home/i })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await pageNavigation.getByRole('button', { name: /Photo studio/i }).click();
    await expect(page).toHaveURL(/d=photo-enhancement/);

    await page.goBack();
    await expect(page).toHaveURL(/d=command-center/);
    await expect(pageNavigation).toBeVisible({ timeout: 30_000 });

    await pageNavigation.getByRole('button', { name: /Video studio/i }).click();
    await expect(page).toHaveURL(/d=listing-video/);

    await page.goto('/ai-editing?d=video-cleanup');
    await page.reload();
    await expect(page).toHaveURL(/d=video-cleanup/);
    await expect(page.getByTestId('application-sidebar')).toHaveCount(1);
    await expect(page.getByRole('tablist', { name: 'Studio media mode' })).toHaveCount(0);
  });
});
