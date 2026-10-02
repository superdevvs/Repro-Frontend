import { expect, test } from '@playwright/test';
import { installStudioFixtures } from './helpers/studio-v4-fixtures';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`catalog search and buffer settings at ${viewport.width}px`, async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize(viewport);
    await installStudioFixtures(page, baseURL);
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    let settings = { mode: 'google', fixed_minutes: 15, minimum_minutes: 15, allowance_minutes: 5, fallback: 'mileage', near_minutes: 15, medium_minutes: 30, far_minutes: 45 };
    let saves = 0;
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const reply = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      if (path === '/api/me/permissions') return reply({ permissionIds: ['scheduling-settings:view', 'scheduling-settings:create', 'scheduling-settings:update', 'dashboard:view'], permissions: ['view', 'create', 'update'].map(action => ({ resource: 'scheduling-settings', action })).concat([{ resource: 'dashboard', action: 'view' }]) });
      if (path === '/api/categories') return reply([{ id: '1', name: 'Photos', icon: 'Camera' }]);
      if (path === '/api/services' || path === '/api/admin/services') return reply({ data: [
        { id: 1, name: '10 Exterior HDR Photos', description: 'Exterior photography', price: 100, active: true, photographer_required: true, shoot_duration_minutes: 30, category: { id: 1, name: 'Photos' } },
        { id: 2, name: '25 HDR Photos', description: 'Interior and exterior photography', price: 175, active: true, photographer_required: true, shoot_duration_minutes: 45, category: { id: 1, name: 'Photos' } },
      ] });
      if (path === '/api/admin/service-groups') return reply({ data: [] });
      if (path === '/api/admin/scheduling/buffer-settings') {
        if (route.request().method() === 'PUT') { settings = { ...route.request().postDataJSON() }; saves++; }
        return reply({ data: { settings, version: 'a'.repeat(64), google: { key_configured: true, budget: { used_elements: 130, limit_elements: 10000, usage_percent: 1.3, estimated_cost_usd: 1.3, budget_usd: 100, exhausted: false } } } });
      }
      return route.fallback();
    });
    await page.goto('/scheduling-settings');
    const search = page.getByRole('textbox', { name: 'Search services', exact: true });
    await expect(search).toBeVisible();
    await expect(page.getByText('10 Exterior HDR Photos', { exact: true })).toBeVisible();
    await search.fill('25 HDR');
    await expect(page.getByText('10 Exterior HDR Photos', { exact: true })).toHaveCount(0);
    await expect(page.getByText('25 HDR Photos', { exact: true })).toBeVisible();
    await search.fill('');
    const searchBounds = await search.boundingBox();
    const addBounds = await page.getByRole('button', { name: /^(New|Add Service)$/ }).boundingBox();
    expect(searchBounds!.x + searchBounds!.width).toBeLessThanOrEqual(addBounds!.x + 1);
    expect(Math.abs(searchBounds!.y - addBounds!.y)).toBeLessThan(5);
    await page.screenshot({ path: testInfo.outputPath('catalog.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Service actions' }).click();
    await page.getByRole('menuitem', { name: 'Buffer time' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Buffer time', exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Minimum gap')).toHaveValue('15');
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('google-buffers.png'), fullPage: true, animations: 'disabled' });
    await dialog.getByRole('button', { name: /Mileage estimate/ }).click();
    await expect(dialog.getByLabel('Up to 5 mi')).toHaveValue('15');
    await expect(dialog.getByLabel('Minimum gap')).toHaveCount(0);
    await dialog.getByRole('button', { name: /Fixed gap/ }).click();
    await dialog.getByLabel('Gap between shoots').fill('30');
    expect(saves).toBe(0);
    await dialog.getByRole('button', { name: 'Save buffer settings' }).click();
    await expect(dialog).toHaveCount(0);
    expect(saves).toBe(1);
    await page.getByRole('button', { name: 'Service actions' }).click();
    await page.getByRole('menuitem', { name: 'Buffer time' }).click();
    await expect(page.getByLabel('Gap between shoots')).toHaveValue('30');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(saves).toBe(1);
  });
}
