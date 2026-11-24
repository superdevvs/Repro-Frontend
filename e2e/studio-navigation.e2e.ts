import { expect, test } from '@playwright/test';

import { installStudioFixtures } from './helpers/studio-v4-fixtures';
import fixtures from '../src/components/listing-studio/client/studioFixtures.test-data.json' with { type: 'json' };

test.describe('AI Editing Studio shell', () => {
  test('keeps one application sidebar across Image, Video and Listing Studio', async ({ page, baseURL }) => {
    await installStudioFixtures(page, baseURL);
    await page.route('**/api/listing-studio/catalog', route => route.fulfill({
      json: { data: { billing: { plans: [], services: [] } } },
    }));
    await page.goto('/ai-editing?d=command-center');

    const sidebar = page.getByTestId('application-sidebar');
    await expect(sidebar).toHaveCount(1);
    await expect(sidebar.getByRole('link', { name: 'Listing Studio', exact: true })).toHaveCount(0);
    const sections = page.getByRole('tablist', { name: 'AI Editing sections' });
    await expect(sections.getByRole('tab')).toHaveText(['Image', 'Video', 'Listing Studio']);
    await expect(sections.getByRole('tab', { name: 'Image', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('combobox', { name: 'Editing preset' })).toContainText('Listing ready');

    await sections.getByRole('tab', { name: 'Video', exact: true }).click();
    await expect(sections.getByRole('tab', { name: 'Video', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('combobox', { name: 'Editing preset' })).toContainText('Walkthrough');
    await page.getByRole('button', { name: 'Editing history' }).click();
    await expect(page.getByRole('heading', { name: 'Your editing history' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Studio' }).click();
    await expect(page.getByRole('textbox', { name: 'Describe your edit' })).toBeVisible();

    await sections.getByRole('tab', { name: 'Listing Studio', exact: true }).click();
    await expect(page).toHaveURL(/section=listing-studio/);
    await expect(page.getByRole('heading', { name: 'Monthly client plans' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Studio revisions' })).toHaveAttribute('href', '/dashboard?requests=editing&editingSource=studio');
    await expect(sidebar).toHaveCount(1);
    await expect(sidebar.getByRole('link', { name: 'AI Editing', exact: true })).toHaveAttribute('data-sidebar-active', 'true');
  });

  test('offers the Studio revisions workflow to editing managers', async ({ page, baseURL }) => {
    await installStudioFixtures(page, baseURL, [], 'editing_manager');
    await page.goto('/ai-editing');
    const sections = page.getByRole('tablist', { name: 'AI Editing sections' });
    await sections.getByRole('tab', { name: 'Listing Studio', exact: true }).click();

    await expect(page.getByRole('link', { name: 'Open Studio revisions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monthly client plans' })).toHaveCount(0);
    await expect(page.getByTestId('application-sidebar').getByRole('link', { name: 'Listing Studio', exact: true })).toHaveCount(0);
  });

  test('keeps the client Listing Studio shortcut separate from staff AI Editing', async ({ page, baseURL }) => {
    await installStudioFixtures(page, baseURL, [], 'client');
    await page.route('**/api/listing-studio/client/account', route => route.fulfill({ json: { data: fixtures.account } }));
    await page.goto('/ai-editing?section=listing-studio');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('tablist', { name: 'AI Editing sections' })).toHaveCount(0);
    await expect(page.getByTestId('application-sidebar').getByRole('link', { name: 'Listing Studio', exact: true })).toHaveAttribute('href', '/listing-studio');
  });
});
