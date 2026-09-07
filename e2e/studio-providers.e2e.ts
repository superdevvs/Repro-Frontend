import { expect, test } from '@playwright/test';
import { fixtureMedia, installStudioFixtures, workspaceFixture } from './helpers/studio-v4-fixtures';
import type { StudioProviderSettings, StudioProviderUpdate } from '../src/services/studioProviderService';

const settingsFixture = (): StudioProviderSettings => ({
  services: ['listing-ready', 'color-correction', 'full-shoot', 'twilight', 'virtual-staging', 'green-grass', 'sky-replacement', 'perspective-correction', 'revision', 'upscale', 'outpaint', 'walkthrough', 'property-reel', 'social-teaser'].map(id => ({
    id, label: id.replace(/-/g, ' '), provider: 'fal', model: 'current-model', ready: true,
    providers: [
      { id: 'fal', label: 'fal.ai', models: [{ id: 'current-model', label: 'Current service model', ready: true }] },
      { id: 'fotello', label: 'Fotello', models: [{ id: 'enhance', label: 'Photo enhancement', ready: false, reason: 'Connection details required.' }] },
    ], ...(id === 'outpaint' ? { fallback: null } : {}),
  })), credentials: { fotello: { keyConfigured: false, teamIdConfigured: false } },
});

test.describe('Provider settings and photo tools', () => {
  for (const width of [1440, 390]) {
    test(`keeps key-only configuration pending and photo controls usable at ${width}px`, async ({ page, baseURL }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const workspace = workspaceFixture({ status: 'completed', outputs: fixtureMedia.slice(0, 3).map(item => ({ id: `${item.id}-v1`, mediaId: item.id, kind: 'image', status: 'completed', version: 1, url: item.url })) });
      const state = await installStudioFixtures(page, baseURL, [workspace], 'superadmin');
      const settings = settingsFixture();
      const updates: StudioProviderUpdate[] = [];
      await page.route('**/api/studio/provider-settings', async route => {
        if (route.request().method() === 'PUT') {
          const input = route.request().postDataJSON() as StudioProviderUpdate;
          updates.push(input);
          if (input.credentials?.fotello?.apiKey) settings.credentials.fotello.keyConfigured = true;
          if (input.credentials?.fotello?.teamId) settings.credentials.fotello.teamIdConfigured = true;
          for (const service of settings.services) {
            service.providers[1].models[0].ready = settings.credentials.fotello.keyConfigured && settings.credentials.fotello.teamIdConfigured && ['listing-ready', 'color-correction', 'full-shoot'].includes(service.id);
          }
          for (const choice of input.services || []) Object.assign(settings.services.find(service => service.id === choice.id)!, choice);
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: settings }) });
      });
      await page.goto('/settings?tab=ai-editing');
      await expect(page.getByLabel('API key', { exact: true })).toBeVisible();
      await page.getByLabel('API key', { exact: true }).fill('local-playwright-fixture-only');
      await page.getByRole('button', { name: 'Save connection details' }).click();
      await expect(page.getByText('Team ID pending')).toBeVisible();
      await expect(page.getByLabel('API key', { exact: true })).toHaveValue('');
      await expect(page.getByRole('button', { name: 'Use Fotello for enhancement' })).toBeDisabled();
      expect(updates).toEqual([{ credentials: { fotello: { apiKey: 'local-playwright-fixture-only' } } }]);
      await expect(page.getByRole('combobox', { name: 'listing ready API', exact: true })).toHaveValue('fal');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`provider-settings-${width}.png`), animations: 'disabled' });
      await page.getByLabel('Team ID', { exact: true }).fill('team_fixture');
      await page.getByRole('button', { name: 'Save connection details' }).click();
      await expect(page.getByRole('button', { name: 'Use Fotello for enhancement' })).toBeEnabled();
      await page.getByRole('button', { name: 'Use Fotello for enhancement' }).click();
      await expect(page.getByRole('combobox', { name: 'listing ready API', exact: true })).toHaveValue('fotello');
      await expect(page.getByRole('combobox', { name: 'twilight API', exact: true })).toHaveValue('fal');
      await expect(page.getByRole('combobox', { name: 'twilight API', exact: true }).locator('option[value="fotello"]')).toHaveAttribute('disabled', '');
      expect(updates).toHaveLength(2);
      await page.getByRole('combobox', { name: 'listing ready API', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`service-routing-${width}.png`), animations: 'disabled' });

      await page.goto(`/ai-editing?workspace=${workspace.id}`);
      await page.getByRole('button', { name: 'Open Image 01.jpg', exact: true }).click();
      await page.getByRole('button', { name: 'Detect areas' }).click();
      const dialog = page.getByRole('dialog', { name: 'Refine Image 01.jpg' });
      await expect(dialog.getByText('Reference photos · 0 of 4')).toBeVisible();
      await dialog.getByText('Reference photos · 0 of 4').click();
      await dialog.getByRole('button', { name: 'Reference Image 02.jpg' }).click();
      await expect(dialog.getByRole('button', { name: 'Reference Image 02.jpg' })).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByText(/fotello/i)).toHaveCount(0);
      await dialog.getByLabel('Describe the change').fill('Match the reference lighting while preserving the room.');
      await expect(dialog.getByRole('button', { name: 'Generate revision' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Generate revision' })).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`reference-revision-${width}.png`), animations: 'disabled' });
      expect(state.requests.some(request => request.method === 'POST' && /\/(generate|prepare|upscale|revisions)$/.test(request.path))).toBe(false);
    });
  }
});
