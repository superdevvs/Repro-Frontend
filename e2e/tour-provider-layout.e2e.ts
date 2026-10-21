import { expect, test } from '@playwright/test';
import { installShootDetailsWorkspaceFixture, workspaceAddress } from './helpers/shoot-details-workspace-fixture';

test.use({ timezoneId: 'Asia/Kolkata', video: 'off' });
const providers = [
  ['matterport', 'Matterport'], ['iguide', 'iGUIDE'], ['cubicasa', 'CubiCasa'], ['zillow', 'Zillow 3D'],
] as const;
const cases = [
  ...[320, 390, 430, 820, 1440].flatMap(width => (['dark', 'light'] as const).map(theme => ({ width, theme, surface: 'overview', role: 'admin' as const }))),
  ...[390, 1440].map(width => ({ width, theme: 'dark' as const, surface: 'page', role: 'admin' as const })),
  { width: 390, theme: 'dark' as const, surface: 'overview', role: 'salesRep' as const },
];

for (const { width, theme, surface, role } of cases) {
  test(`${surface} Tours providers stay readable for ${role} at ${width}px ${theme}`, async ({ page, baseURL, browserName }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await installShootDetailsWorkspaceFixture(page, baseURL, role, theme, { salesRepManagement: role === 'salesRep' });
    await page.goto('/shoots/156');
    const overview = page.getByRole('dialog', { name: `#156 · ${workspaceAddress}`, exact: true });
    await expect(overview).toBeVisible();
    if (surface === 'overview') {
      await overview.getByRole('tab', { name: 'Tours', exact: true }).click();
    } else {
      await page.keyboard.press('Escape');
      await expect(overview).toBeHidden();
      await page.getByRole('tablist', { name: /^(Shoot page sections|Shoot tools)$/ }).getByRole('tab', { name: 'Tour', exact: true }).click();
    }
    const section = page.getByRole('region', { name: '3D & floor plans', exact: true });
    await expect(section).toBeVisible();
    await page.waitForLoadState('networkidle');
    await section.scrollIntoViewIfNeeded();

    for (const [id, title] of providers) {
      const row = section.getByTestId(`tour-provider-${id}`);
      await expect(row).toBeVisible();
      const name = row.getByText(title, { exact: true });
      expect(await name.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      const toggle = row.getByRole('button').first();
      const badge = toggle.locator('.rounded-full');
      const bounds = await badge.evaluate(element => {
        const text = document.createRange(); text.selectNodeContents(element);
        const textBox = text.getBoundingClientRect(), box = element.getBoundingClientRect();
        return { textHeight: textBox.height, height: box.height, textLeft: textBox.left, textRight: textBox.right, left: box.left, right: box.right };
      });
      expect(bounds.textHeight).toBeLessThanOrEqual(bounds.height);
      expect(bounds.textLeft).toBeGreaterThanOrEqual(bounds.left);
      expect(bounds.textRight).toBeLessThanOrEqual(bounds.right + 1);
      const rowBox = await row.boundingBox();
      // Keep the original compact row height; moving actions underneath must
      // not trade the clipping bug for a much taller mobile list.
      expect(rowBox!.height).toBeLessThanOrEqual(64);
      for (const control of await row.getByRole('button').all()) {
        const controlBox = await control.boundingBox();
        expect(controlBox!.x).toBeGreaterThanOrEqual(rowBox!.x - 1);
        expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
      }
      await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    const overflow = await section.evaluate(element => element.scrollWidth > element.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await section.scrollIntoViewIfNeeded();
    if (process.env.E2E_SHOOT_SCREENSHOT_DIR) await section.screenshot({ path: `${process.env.E2E_SHOOT_SCREENSHOT_DIR}/providers-${surface}-${role}-${width}-${theme}-${browserName}.png` });

    if (role === 'admin') {
      const matterport = section.getByTestId('tour-provider-matterport');
      await matterport.getByRole('button', { name: 'Add link', exact: true }).click();
      await expect(matterport.getByPlaceholder('https://', { exact: true })).toBeVisible();
      await matterport.getByRole('button', { name: 'Cancel', exact: true }).click();
      await matterport.getByRole('button', { name: 'Matterport actions', exact: true }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      await expect(section.getByRole('button', { name: 'Upload ZIP', exact: true })).toHaveCount(0);
    }
    expect(fixture.businessWrites).toEqual([]);
    expect(fixture.pageErrors).toEqual([]);
  });
}
