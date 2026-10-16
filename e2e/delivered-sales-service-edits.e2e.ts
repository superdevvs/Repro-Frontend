import { expect, test } from '@playwright/test';
import path from 'node:path';
import { installShootDetailsWorkspaceFixture, workspaceAddress } from './helpers/shoot-details-workspace-fixture';

test.setTimeout(120_000);

for (const width of [1440, 390]) {
  test(`sales rep corrects delivered services and quantities at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await installShootDetailsWorkspaceFixture(page, baseURL, 'salesRep', 'dark', { salesRepManagement: true });
    const catalog = [...state.shoot.services.map(service => ({ ...service, allow_multiple: true })), {
      id: 104, name: 'Virtual Staging', price: 75, quantity: 1, allow_multiple: true,
      category: { id: 4, name: 'Add-ons' }, photographer_required: false, upload_intake_type: 'none',
    }];
    await page.route('**/api/services', route => route.fulfill({ json: { data: catalog } }));
    const saves: Record<string, unknown>[] = [];
    await page.route('**/api/shoots/156', async route => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saves.push(body);
      if (saves.length === 1) return route.fulfill({ status: 409, json: {
        code: 'service_detach_confirmation_required', confirmation_token: 'local-removal-confirmation',
        message: 'Confirm service removal before saving this shoot.',
        impact: { removed_services: [{ service_id: 103, name: 'Listing Video', price: 50, quantity: 1 }],
          files_detached: 1, current_total: 425, new_total: 700, total_paid: 425, new_balance: 275,
          refund_credit_due: 0, leaves_no_services: false },
      } });
      return route.fulfill({ json: { success: true, data: state.shoot } });
    });
    await page.goto('/shoots/156', { waitUntil: 'domcontentloaded' });
    const overview = page.getByRole('dialog', { name: `#156 · ${workspaceAddress}`, exact: true });
    await expect(overview).toBeVisible({ timeout: 60_000 });
    if (width < 640) {
      await overview.getByRole('button', { name: 'More actions', exact: true }).click();
      await page.getByRole('button', { name: 'Edit shoot', exact: true }).click();
    } else {
      await overview.getByRole('button', { name: 'Edit', exact: true }).click();
    }
    await expect(overview.getByTestId('add-new-service')).toBeVisible();
    for (const assignment of await overview.getByTestId('photographer-cell').all()) await expect(assignment).toBeDisabled();
    await expect(overview.locator('input[type="date"], input[type="time"]')).toHaveCount(0);
    await overview.getByTestId('add-new-service').click();
    const picker = page.getByTestId('service-picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Increase HDR Photos quantity', exact: true }).click();
    await picker.getByRole('checkbox', { name: 'Select Virtual Staging', exact: true }).check();
    await picker.getByRole('button', { name: /^Done(?: selecting)?$/ }).click();
    await expect(picker).toBeHidden();
    await overview.getByRole('button', { name: 'Remove Listing Video', exact: true }).click();
    await expect(overview.getByTestId('service-cell').filter({ hasText: 'HDR Photos × 2' })).toBeVisible();
    await expect(overview.getByTestId('service-cell').filter({ hasText: 'Virtual Staging' })).toBeVisible();
    if (process.env.E2E_SHOOT_SCREENSHOT_DIR) {
      await page.screenshot({ path: path.join(process.env.E2E_SHOOT_SCREENSHOT_DIR, `delivered-sales-services-${width}.png`), fullPage: true });
    }
    await overview.getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).first().click();
    const confirmUpdate = page.getByRole('dialog', { name: 'Confirm update', exact: true });
    await expect(confirmUpdate).toBeVisible();
    for (const checkbox of await confirmUpdate.getByRole('checkbox').all()) await checkbox.uncheck();
    await confirmUpdate.getByRole('button', { name: 'Save changes', exact: true }).click();
    const confirmRemoval = page.getByRole('dialog', { name: 'Confirm service removal', exact: true });
    await expect(confirmRemoval).toBeVisible();
    await expect(confirmRemoval).toContainText('Listing Video');
    await expect(confirmRemoval).toContainText('1 file(s)');
    await confirmRemoval.getByRole('button', { name: 'Confirm removal & save', exact: true }).click();
    await expect.poll(() => saves.length).toBe(2);
    await expect(confirmRemoval).toBeHidden();
    const finalSave = saves[1];
    expect(finalSave.confirm_service_detach).toBe(true);
    expect(finalSave.service_detach_confirmation_token).toBe('local-removal-confirmation');
    expect(finalSave.notify_client).toBe(false);
    expect(finalSave.notify_photographer).toBe(false);
    expect(finalSave.expected_edit_version).toBe('a'.repeat(64));
    expect(finalSave).not.toHaveProperty('admin_adjusted_total_quote');
    const services = finalSave.services as Array<{ id: number; quantity?: number }>;
    expect(services).toEqual(expect.arrayContaining([{ id: 101, quantity: 2 }, { id: 102 }, { id: 104 }]));
    expect(services).toHaveLength(3);
    for (const service of services) expect(Object.keys(service).every(key => ['id', 'quantity'].includes(key))).toBe(true);
    for (const key of ['scheduled_at', 'scheduled_date', 'time', 'photographer_id', 'service_photographers', 'status', 'workflow_status', 'base_quote', 'total_quote']) {
      expect(finalSave).not.toHaveProperty(key);
    }
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}
