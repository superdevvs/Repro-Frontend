import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { installShootDetailsWorkspaceFixture, type ShootWorkspaceRole } from './helpers/shoot-details-workspace-fixture';
test.use({ video: 'off', trace: 'off' });

async function fixture(page: Page, baseURL: string | undefined, role: ShootWorkspaceRole, theme: 'dark' | 'light') {
  const state = await installShootDetailsWorkspaceFixture(page, baseURL, role, theme, { largeCompletionCounts: true });
  const service = state.shoot.services;
  Object.assign(service[0], { shoot_service_id: 101, progress_status: 'delivered' });
  Object.assign(service[1], { shoot_service_id: 102, name: '2D Floor plans', progress_status: 'drafting' });
  Object.assign(service[2], { shoot_service_id: 103, progress_status: 'in_editing' });
  service.push(Object.assign({ ...service[1], id: 104 }, { shoot_service_id: 104, name: 'Premium iGuide with Floor plans', progress_status: 'processing' }));
  service.push(Object.assign({ ...service[1], id: 105 }, { shoot_service_id: 105, name: 'Zillow SHOWCASE Premium', progress_status: 'awaiting_assets' }));
  Object.assign(state.shoot, { serviceItems: service, service_items: service });
  await page.goto('/shoots/156', { waitUntil: 'domcontentloaded' });
  const panel = page.getByRole('dialog').filter({ has: page.locator('.overview-service-rows') });
  await expect(panel).toBeVisible();
  await expect(panel.locator('.service-progress-badge')).toHaveCount(5);
  return { ...state, panel };
}

for (const width of [1440, 820, 390, 320]) for (const theme of ['dark', 'light'] as const) {
  test(`status beside photographer fits ${width}px ${theme}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await fixture(page, baseURL, 'admin', theme);
    const rows = state.panel.locator('.overview-service-rows');
    // Match the screenshot's 514px Services card, even inside a wider dialog.
    await rows.evaluate(node => { const card = node.parentElement; if (card) card.style.maxWidth = '514px'; });
    await expect(rows.locator('.service-row-top .service-progress-badge')).toHaveCount(0);
    for (const [id, label] of [[101, 'Delivered'], [102, 'Drafting'], [103, 'In editing'], [104, 'Processing'], [105, 'Awaiting links & floor plans']] as const) {
      const row = rows.getByTestId(`service-summary-${id}`);
      const badge = row.locator('.service-progress-badge');
      await expect(badge).toHaveText(label);
      await expect(row.locator('.service-row-assignee')).toContainText(label);
      const valid = await row.evaluate(node => {
        const badge = node.querySelector('.service-progress-badge')!.getBoundingClientRect();
        const person = node.querySelector('.service-row-person')?.getBoundingClientRect();
        const counts = node.querySelector('.service-row-counts')?.getBoundingClientRect();
        const bounds = node.getBoundingClientRect();
        const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        return badge.left >= bounds.left - 1 && badge.right <= bounds.right + 1
          && (!person || !overlaps(person, badge)) && (!counts || !overlaps(counts, badge));
      });
      expect(valid).toBe(true);
    }
    await expect(rows.locator('[aria-label="Image counts"]').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
    if (process.env.E2E_SHOOT_SCREENSHOT_DIR) await state.panel.screenshot({ path: path.join(process.env.E2E_SHOOT_SCREENSHOT_DIR, `service-status-${width}-${theme}.png`), animations: 'disabled', timeout: 15000 });
  });
}

for (const role of ['client', 'photographer', 'editor', 'salesRep'] as const) {
  test(`status stays read only and role scoped for ${role}`, async ({ page, baseURL }) => {
    const state = await fixture(page, baseURL, role, 'dark');
    const rows = state.panel.locator('.overview-service-rows');
    await expect(rows.locator('.service-progress-badge')).toHaveCount(5);
    await expect(rows.locator('button.service-progress-badge')).toHaveCount(0);
    if (role === 'photographer' || role === 'editor') await expect(rows.locator('.service-row-person')).toHaveCount(0);
    if (role === 'client') await expect(rows.locator('[aria-label="Image counts"]')).toHaveCount(0);
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  });
}

test('status updates when a refreshed shoot receives a provider transition', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, 'admin', 'dark');
  Object.assign(state.shoot.services[4], { progress_status: 'delivered' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(state.panel.locator('[data-progress="awaiting_assets"]')).toHaveCount(0);
  await expect(state.panel.getByLabel('Zillow SHOWCASE Premium: Delivered', { exact: true })).toBeVisible();
  expect(state.businessWrites).toEqual([]);
});
