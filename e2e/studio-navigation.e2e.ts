import { expect, test } from '@playwright/test';

import { installStudioFixtures } from './helpers/studio-v4-fixtures';

test.describe('AI Editing Studio shell', () => {
  test('keeps one application sidebar across media modes and editing history', async ({ page, baseURL }) => {
    await installStudioFixtures(page, baseURL);
    await page.goto('/ai-editing?d=command-center');

    await expect(page.getByTestId('application-sidebar')).toHaveCount(1);
    const mediaNavigation = page.getByRole('navigation', { name: 'Media type' });
    await expect(mediaNavigation).toBeVisible();
    await expect(mediaNavigation.getByRole('button')).toHaveCount(3);
    await expect(mediaNavigation.getByRole('button', { name: /^studio$/i })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await mediaNavigation.getByRole('button', { name: /^image$/i }).click();
    await expect(mediaNavigation.getByRole('button', { name: /^image$/i })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('combobox', { name: 'Editing preset' })).toContainText('Listing ready');
    await mediaNavigation.getByRole('button', { name: /^video$/i }).click();
    await expect(page.getByRole('combobox', { name: 'Editing preset' })).toContainText('Walkthrough');
    await page.getByRole('button', { name: 'Editing history' }).click();
    await expect(page.getByRole('heading', { name: 'Your editing history' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Studio' }).click();
    await expect(page.getByRole('textbox', { name: 'Describe your edit' })).toBeVisible();
    await expect(page.getByTestId('application-sidebar')).toHaveCount(1);
  });
});
