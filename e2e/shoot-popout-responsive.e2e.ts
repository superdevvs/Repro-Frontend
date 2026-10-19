import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { installShootDetailsWorkspaceFixture, workspaceAddress, type ShootWorkspaceRole } from './helpers/shoot-details-workspace-fixture';

async function expectFitsViewport(page: Page, element: Locator) {
  await expect(element).toBeInViewport({ ratio: 1 }).catch(async error => {
    console.log('Viewport diagnostic', await element.evaluate(node => ({
      rect: node.getBoundingClientRect().toJSON(), viewport: [innerWidth, innerHeight],
      visualViewport: [visualViewport?.width, visualViewport?.height, visualViewport?.offsetTop],
      transform: getComputedStyle(node).transform,
    })));
    throw error;
  });
  const box = await element.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}

test.use({ browserName: process.env.E2E_POPOUT_BROWSER === 'webkit' ? 'webkit' : 'chromium', hasTouch: true, video: 'off', trace: 'off', screenshot: 'off' });

for (const viewport of [
  { width: 744, height: 930 },
  { width: 820, height: 1030 },
  { width: 1024, height: 620 },
  { width: 1180, height: 700 },
  { width: 1280, height: 736 },
  { width: 1440, height: 900 },
  { width: 390, height: 700 },
]) {
  test(`shoot pop-out fits ${viewport.width}x${viewport.height}`, async ({ page, baseURL, browserName }) => {
    await page.setViewportSize(viewport);
    const state = await installShootDetailsWorkspaceFixture(page, baseURL, 'admin', 'dark');
    await page.goto('/shoots/156', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog', { name: `#156 · ${workspaceAddress}`, exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true });
    await expectFitsViewport(page, dialog);
    await expectFitsViewport(page, close);
    const overflow = await dialog.evaluate(element => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const sections = dialog.getByRole('tablist', { name: 'Shoot sections', exact: true });
    await sections.getByRole('tab', { name: 'Notes', exact: true }).click();
    await expect(sections.getByRole('tab', { name: 'Notes', exact: true })).toHaveAttribute('aria-selected', 'true');
    await sections.getByRole('tab', { name: 'Overview', exact: true }).click();
    if (viewport.width < 1280) {
      await sections.getByRole('tab', { name: 'Media', exact: true }).click();
    }
    await dialog.getByRole('tab', { name: 'Edited (6)', exact: true }).filter({ visible: true }).click();
    await expect(dialog.getByText('Front exterior final.jpg', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expectFitsViewport(page, close);

    const sync = dialog.getByRole('button', { name: 'Publish to Bright MLS', exact: true });
    if (viewport.width >= 1280) {
      await expectFitsViewport(page, sync);
      await expectFitsViewport(page, dialog.getByRole('button', { name: 'Downloads', exact: true }));
      const address = await dialog.getByTestId('shoot-address-reveal').boundingBox();
      const syncBox = await sync.boundingBox();
      // Header actions must not cover the address when a tablet needs another row.
      expect(address!.y + address!.height <= syncBox!.y || address!.x + address!.width <= syncBox!.x).toBe(true);
    } else {
      await dialog.getByRole('button', { name: 'More actions', exact: true }).click();
      const actions = page.getByRole('dialog', { name: 'Actions', exact: true });
      await expectFitsViewport(page, actions);
      await expect(actions.getByRole('button', { name: 'Invoice', exact: true })).toBeVisible();
      await expect(actions.getByRole('button', { name: 'Publish to Bright MLS', exact: true })).toBeVisible();
      await expectFitsViewport(page, actions.getByRole('button', { name: 'Cancel', exact: true }));
      await actions.getByRole('button', { name: 'Cancel', exact: true }).click();
    }

    // Browser bars and rotation can change the available height while the pop-out is open.
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 120 });
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.height)).toBe(viewport.height - 120 - (viewport.width >= 640 ? 32 : 0));
    await expectFitsViewport(page, dialog);
    await expectFitsViewport(page, close);
    await page.setViewportSize(viewport);
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.height)).toBe(viewport.height - (viewport.width >= 640 ? 32 : 0));
    if (viewport.width === 820) {
      await page.setViewportSize({ width: 1280, height: 736 });
      await expect(dialog.getByRole('tablist', { name: 'Shoot sections', exact: true }).getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expectFitsViewport(page, dialog);
      await page.setViewportSize(viewport);
      await expect(sections.getByRole('tab', { name: 'Media', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect.poll(async () => Math.round((await dialog.boundingBox())!.height)).toBe(viewport.height - 32);
    }
    if (process.env.E2E_SHOOT_SCREENSHOT_DIR) {
      await page.screenshot({ path: path.join(process.env.E2E_SHOOT_SCREENSHOT_DIR, `shoot-popout-${browserName}-${viewport.width}.png`) });
    }
    await close.click();
    await expect(dialog).toBeHidden();
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  });
}

for (const role of ['client', 'salesRep', 'editor', 'photographer'] as ShootWorkspaceRole[]) {
  test(`${role} can use portrait tablet overview and media`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 820, height: 1030 });
    const state = await installShootDetailsWorkspaceFixture(page, baseURL, role, 'light');
    await page.goto('/shoots/156', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog', { name: `#156 · ${workspaceAddress}`, exact: true });
    await expect(dialog).toBeVisible();
    const sections = dialog.getByRole('tablist', { name: 'Shoot sections', exact: true });
    await sections.getByRole('tab', { name: 'Media', exact: true }).click();
    await expect(dialog.locator('.shoot-media-workspace').filter({ visible: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'More actions', exact: true }).click();
    const actions = page.getByRole('dialog', { name: 'Actions', exact: true });
    const sync = actions.getByRole('button', { name: 'Publish to Bright MLS', exact: true });
    if (role === 'client' || role === 'salesRep') await expect(sync).toBeVisible();
    else await expect(sync).toHaveCount(0);
    await actions.getByRole('button', { name: 'Cancel', exact: true }).click();
    await sections.getByRole('tab', { name: 'Overview', exact: true }).click();
    await expectFitsViewport(page, dialog);
    await dialog.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true }).click();
    await expect(dialog).toBeHidden();
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  });
}
