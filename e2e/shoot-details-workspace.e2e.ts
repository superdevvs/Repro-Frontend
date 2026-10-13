import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { installShootDetailsWorkspaceFixture, workspaceAddress, workspaceClientEmail, workspaceClientPhone, workspaceEditedPhotoCount, type ShootWorkspaceRole } from './helpers/shoot-details-workspace-fixture';

test.describe.configure({ mode: 'parallel' });
const overview = (page: Page) => page.getByRole('dialog', { name: `#156 · ${workspaceAddress}`, exact: true });
const openOverview = (page: Page) => page.getByRole('button', { name: 'Open shoot overview', exact: true });
const sections = (page: Page) => page.getByRole('tablist', { name: /^(Shoot page sections|Shoot tools)$/ });

async function revealShootRecord(page: Page, width: number) {
  if (width < 1024) {
    const summary = page.locator('.shoot-workspace-mobile-record > summary');
    await summary.click();
    await expect(page.locator('.shoot-workspace-mobile-record')).toHaveAttribute('open', '');
  }
}

async function closeOverview(page: Page) {
  await page.keyboard.press('Escape');
  await expect(overview(page)).toBeHidden();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(openOverview(page)).toBeVisible();
}

async function screenshot(page: Page, filename: string) {
  if (process.env.E2E_SHOOT_SCREENSHOT_DIR) {
    await page.screenshot({ path: path.join(process.env.E2E_SHOOT_SCREENSHOT_DIR, filename), fullPage: true });
  }
}

for (const width of [1440, 820, 390, 320]) for (const theme of ['dark', 'light'] as const) {
  test(`media workspace preserves overview and responsive controls at ${width}px ${theme}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await installShootDetailsWorkspaceFixture(page, baseURL, 'admin', theme);
    await page.goto('/shoots/156');
    await expect(page.getByRole('heading', { name: new RegExp(workspaceAddress) }).first()).toBeVisible();
    await expect(overview(page)).toBeVisible();
    await expect(overview(page).getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    await closeOverview(page);
    await page.waitForTimeout(2200);
    await expect(overview(page)).toBeHidden();
    if (width === 1440) {
      const refreshed = page.waitForResponse(response => /\/api\/shoots\/156$/.test(response.url()));
      await page.evaluate(async () => {
        const modulePath = '/src/realtime/realtimeRefreshBus.ts';
        const { triggerShootDetailRefresh } = await import(modulePath);
        triggerShootDetailRefresh(156);
      });
      await refreshed;
      await page.waitForTimeout(2200);
      await expect(overview(page)).toBeHidden();
    }
    await openOverview(page).click();
    await expect(overview(page)).toBeVisible();
    await closeOverview(page);
    await openOverview(page).click();
    await expect(overview(page)).toBeVisible();
    await closeOverview(page);

    await expectNoHorizontalOverflow(page);
    await revealShootRecord(page, width);
    const team = page.getByRole('region', { name: 'Services and team', exact: true }).filter({ visible: true });
    await expect(team.getByText('HDR Photos', { exact: true })).toBeVisible();
    const hdrRow = team.locator('div.flex.items-start').filter({ has: page.getByText('HDR Photos', { exact: true }) }).first();
    await expect(hdrRow).toContainText('Jay Snap');
    const floorRow = team.locator('div.flex.items-start').filter({ has: page.getByText('Zillow 3D with Floor Plans', { exact: true }) }).first();
    await expect(floorRow).toContainText('Alex Lens');
    await page.getByText('Contact details', { exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: workspaceClientEmail, exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByRole('button', { name: workspaceClientPhone, exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByText('Contact details', { exact: true }).filter({ visible: true }).click();
    const billing = page.getByRole('region', { name: 'Billing', exact: true }).filter({ visible: true });
    await billing.getByText('Billing details', { exact: true }).click();
    await expect(billing.getByText('Outstanding', { exact: true })).toBeVisible();
    await expect(billing.getByText('$0.00', { exact: true }).last()).toBeVisible();
    await billing.getByText('Billing details', { exact: true }).click();
    if (width < 1024) await page.locator('.shoot-workspace-mobile-record > summary').click();

    await page.getByRole('tab', { name: /^Raw(?: Uploads)? \(4\)$/ }).click();
    await expect(page.getByRole('button', { name: 'Photos (2)', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Video (1)', exact: true }).click();
    await expect(page.getByText('Property walkthrough.mp4', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Floor Plans (1)', exact: true }).click();
    await expect(page.getByText('Floor plan.jpg', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Photos (2)', exact: true }).click();
    await page.getByRole('tab', { name: `Edited (${workspaceEditedPhotoCount})`, exact: true }).click();
    await expect(page.getByText('Front exterior final.jpg', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'List view', exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: 'List view', exact: true }).filter({ visible: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Front exterior final.jpg', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    if (width < 640) {
      const actions = page.getByRole('button', { name: 'Editing actions for Front exterior final.jpg', exact: true });
      await actions.scrollIntoViewIfNeeded();
      await expect(actions).toBeInViewport();
      const bounds = await actions.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
    if (width < 640) {
      await page.locator('.shoot-media-list-row').filter({ visible: true }).first().scrollIntoViewIfNeeded();
      await screenshot(page, `shoot-workspace-list-${theme}-${width}.png`);
    }
    await page.getByRole('button', { name: 'Grid view', exact: true }).filter({ visible: true }).click();
    const grid = page.locator('.shoot-media-grid').filter({ visible: true }).first();
    const columnCount = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(columnCount).toBe(width >= 820 ? 3 : 2);
    await expect(grid.locator('img')).toHaveCount(workspaceEditedPhotoCount);
    await expect.poll(() => grid.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await grid.locator('img').first().scrollIntoViewIfNeeded();
    await expectNoHorizontalOverflow(page);
    await screenshot(page, `shoot-workspace-${theme}-${width}.png`);

    // Tab changes refresh/mount real panels without restarting the automatic overview.
    if (width === 1440) {
      for (const name of ['Requests', 'Tour', 'Slideshow', 'Settings', 'Activity Log', 'Notes', 'Media']) {
        const tab = sections(page).getByRole('tab', { name, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        const activePanel = page.getByRole('tabpanel').filter({ visible: true }).first();
        await expect(activePanel).toBeVisible();
        if (name !== 'Media') {
          await expect(page.locator('.shoot-workspace-media-panel')).toBeHidden();
          const headerBox = await page.locator('.shoot-workspace-header').boundingBox();
          const panelBox = await activePanel.boundingBox();
          expect(headerBox).not.toBeNull(); expect(panelBox).not.toBeNull();
          expect(panelBox!.y - (headerBox!.y + headerBox!.height)).toBeLessThan(80);
        }
        if (name === 'Tour') await expect(page.getByText('Aryeo Flow is not connected for this client yet.', { exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      }
      await page.waitForTimeout(2200);
      await expect(overview(page)).toBeHidden();
    }
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  });
}

for (const role of ['client', 'editor', 'photographer', 'salesRep'] as ShootWorkspaceRole[]) for (const width of [1440, 390]) {
  test(`${role} retains privacy and action guards at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await installShootDetailsWorkspaceFixture(page, baseURL, role, 'dark');
    await page.goto('/shoots/156');
    await expect(overview(page)).toBeVisible();
    await closeOverview(page);
    await expectNoHorizontalOverflow(page);
    await revealShootRecord(page, width);
    await expect(page.getByRole('region', { name: 'Billing', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Add Service', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Reschedule', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: /^(Send to Editing|Finalize|Mark as Paid|Notify)$/ })).toBeHidden();
    if (role === 'editor') {
      await expect(page.getByText('Tracy Grubb', { exact: true })).toBeHidden();
      await expect(page.getByText('Contact details', { exact: true })).toBeHidden();
      await expect(sections(page).getByRole('tab', { name: 'Settings', exact: true })).toBeHidden();
    }
    if (role === 'photographer') {
      await expect(page.getByText('Tracy Grubb', { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(page.getByText(workspaceClientEmail, { exact: true })).toBeHidden();
      await expect(page.getByText(workspaceClientPhone, { exact: true })).toBeHidden();
      await expect(page.getByText('Contact details', { exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Edited Media', exact: true })).toBeVisible();
    }
    if (role === 'client') {
      await expect(page.getByRole('tab', { name: /^Raw(?: Uploads)?/ })).toBeHidden();
      await expect(page.getByRole('button', { name: `Photos (${workspaceEditedPhotoCount})`, exact: true })).toBeVisible();
      await expect(sections(page).getByRole('tab', { name: 'Activity Log', exact: true })).toBeHidden();
    }
    if (role === 'salesRep') {
      await page.getByText('Contact details', { exact: true }).filter({ visible: true }).click();
      await expect(page.getByRole('button', { name: workspaceClientEmail, exact: true }).filter({ visible: true })).toBeVisible();
      await expect(sections(page).getByRole('tab', { name: 'Activity Log', exact: true })).toBeVisible();
    }
    const visibleTabs = await sections(page).getByRole('tab').all();
    for (const tab of visibleTabs) {
      if (!await tab.isEnabled()) continue;
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel').filter({ visible: true }).first()).toBeVisible();
    }
    await sections(page).getByRole('tab', { name: 'Media', exact: true }).click();
    await expect(overview(page)).toBeHidden();
    await page.getByRole('button', { name: 'Shoot actions', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: /^(Process Payment|Mark on hold|Review hold request|Finalize|Send to Editing)/ })).toBeHidden();
    await page.keyboard.press('Escape');
    await openOverview(page).click();
    await expect(overview(page)).toBeVisible();
    await closeOverview(page);
    await screenshot(page, `shoot-workspace-${role}-${width}.png`);
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  });
}
