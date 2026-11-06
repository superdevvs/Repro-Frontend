import { expect, test } from '@playwright/test';
import path from 'node:path';
import { installShootDetailsWorkspaceFixture, workspaceAddress } from './helpers/shoot-details-workspace-fixture';

test.setTimeout(120_000);

for (const role of ['salesRep', 'admin'] as const) for (const width of [1440, 390]) {
  test(`${role} saves a cancellation-fee payee and retains it after reload at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await installShootDetailsWorkspaceFixture(page, baseURL, role, 'dark', { salesRepManagement: true });
    const publishedOrigin = process.env.E2E_PUBLISHED_BUNDLE_ORIGIN;
    if (publishedOrigin) {
      if (publishedOrigin !== 'https://reprodashboard.com') throw new Error('Unexpected published bundle origin.');
      // Replay published static assets on loopback; every API remains intercepted by the fixture.
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/') || !['localhost', '127.0.0.1'].includes(url.hostname)) return route.fallback();
        if (route.request().method() !== 'GET') return route.abort();
        const response = await route.fetch({ url: new URL(url.pathname + url.search, publishedOrigin).href });
        await route.fulfill({ response });
      });
    }
    const photographer = { id: 21, name: 'Ivan Review', role: 'photographer', service_capabilities: ['category:13'], account_status: 'active' };
    const photo = {
      id: 3, service_id: 3, name: '25 Flash Photos', price: 125, quantity: 1,
      category: { id: 13, name: 'Flash Photos' }, photographer_required: true,
      photographer_id: 21, photographer, shoot_duration_minutes: 60, duration_minutes: 60,
      upload_intake_type: 'photo', workflow_status: 'in_progress', delivery_status: 'not_started',
      shoot_service_id: 6128, shoot_unit_id: 15, client_key: 'photo-line',
      scheduled_at: '2026-11-06T15:00:00Z', financial_only: false,
    };
    const fee = {
      id: 90, name: 'Onsite Cancellation/hold fee', price: 60, photographer_pay: 50,
      quantity: 1, allow_multiple: true, category: { id: 38, name: 'Cancellation/Hold' },
      financial_only: true, photographer_required: true, allows_photographer_assignment: true,
      shoot_duration_minutes: 60, upload_intake_type: 'none', requires_editing: true,
    };
    const current = state.shoot as unknown as Record<string, unknown>;
    Object.assign(current, {
      status: 'uploaded', workflow_status: 'uploaded', services: [photo], serviceItems: [photo], service_items: [photo], service_lines: [photo],
      units_revision: 1, units: [{ id: 15, client_key: 'unit-one', label: '1', kind: 'unit', sqft: 2004, beds: 2, baths: 1 }],
      photographer, photographer_id: 21, canEditAppointment: true, canReassignPhotographer: true,
      scheduled_at: '2026-11-06T15:00:00Z', scheduled_instant: '2026-11-06T15:00:00Z', scheduled_date: '2026-11-06', time: '10:00',
      total_quote: 125, base_quote: 125, total_paid: 0, payment_status: 'unpaid', raw_photo_count: 10, edited_photo_count: 0,
    });
    await page.route('**/api/services', route => route.fulfill({ json: { data: [photo, fee] } }));
    await page.route(new RegExp('/api/(photographers|users)(?:[?/]|$)'), route => route.fulfill({ json: { data: [photographer] } }));
    await page.route('**/api/photographer/availability/feasibility', route => route.fulfill({ json: { data: {
      enabled: true, status: 'available', available: true, reason_codes: [], visits: [], transitions: [], alternatives: [],
      can_override: false, can_confirm_location: false, policy_version: 'fixture-policy', schedule_version: 'fixture-schedule',
    } } }));
    const saves: Record<string, unknown>[] = [];
    await page.route('**/api/shoots/156', async route => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const body = route.request().postDataJSON() as Record<string, unknown>;
      saves.push(body);
      const lines = body.service_lines as Record<string, unknown>[];
      const savedFee = lines.find(line => String(line.service_id) === '90');
      expect(savedFee).toMatchObject({ photographer_id: 21 });
      expect(Number(savedFee?.duration_minutes ?? 0)).toBe(0);
      expect(savedFee?.scheduled_at ?? null).toBeNull();
      const retainedPhoto = lines.find(line => String(line.service_id) === '3');
      expect(String(retainedPhoto?.shoot_service_id)).toBe('6128');
      expect(retainedPhoto).toMatchObject({ duration_minutes: 60, photographer_id: 21 });
      expect(body.notify_client).toBe(false);
      expect(body.notify_photographer).toBe(false);
      const bookedFee = { ...fee, ...savedFee, id: 90, name: fee.name, category: fee.category, price: 60,
        photographer_id: 21, photographer, shoot_service_id: 9001, shoot_unit_id: 15, duration_minutes: 0,
        scheduled_at: null, financial_only: true, allows_photographer_assignment: true,
        photographer_required: false, workflow_status: 'pending', delivery_status: 'not_started', is_deliverable: false };
      Object.assign(current, { services: [photo, bookedFee], serviceItems: [photo, bookedFee], service_items: [photo, bookedFee], service_lines: [photo, bookedFee], units_revision: saves.length + 1, total_quote: 125 + 60 * Number(bookedFee.quantity ?? 1) });
      await route.fulfill({ json: { success: true, data: current } });
    });
    await page.goto('/shoots/156', { waitUntil: 'domcontentloaded' });
    const overview = page.getByRole('dialog', { name: `#156 · ${workspaceAddress}`, exact: true });
    const edit = async () => {
      await expect(overview).toBeVisible({ timeout: 60_000 });
      if (width < 640) {
        await overview.getByRole('button', { name: 'More actions', exact: true }).click();
        await page.getByRole('button', { name: 'Edit shoot', exact: true }).click();
      } else await overview.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(overview.getByTestId('add-new-service')).toBeVisible();
    };
    await edit();
    await overview.getByTestId('add-new-service').click();
    const picker = page.getByTestId('service-picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('checkbox', { name: `Select ${fee.name}`, exact: true }).check();
    await picker.getByRole('button', { name: /^Done(?: selecting)?$/ }).click();
    const feeRow = overview.getByRole('row').filter({ has: page.getByTestId('service-cell').filter({ hasText: fee.name }) });
    await expect(feeRow).toContainText('Ivan Review');
    await expect(feeRow).toContainText('No visit required');
    const evidence = process.env.E2E_SHOOT_SCREENSHOT_DIR;
    await feeRow.scrollIntoViewIfNeeded();
    if (evidence) await page.screenshot({ path: path.join(evidence, `fee-${role}-${width}-before-save.png`), fullPage: true });
    await overview.getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).first().click();
    const confirm = page.getByRole('dialog', { name: 'Confirm update', exact: true });
    await expect(confirm).toBeVisible();
    for (const checkbox of await confirm.getByRole('checkbox').all()) await checkbox.uncheck();
    await confirm.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect.poll(() => saves.length).toBe(1);
    await expect(confirm).toBeHidden();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await edit();
    await expect(feeRow).toContainText('Ivan Review');
    await expect(feeRow).toContainText('No visit required');
    await feeRow.scrollIntoViewIfNeeded();
    if (evidence) await page.screenshot({ path: path.join(evidence, `fee-${role}-${width}-after-reload.png`), fullPage: true });
    await feeRow.getByTestId('service-cell').click();
    await picker.getByRole('button', { name: `Increase ${fee.name} quantity`, exact: true }).click();
    await picker.getByRole('button', { name: /^Done(?: selecting)?$/ }).click();
    await overview.getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).first().click();
    await expect(confirm).toBeVisible();
    for (const checkbox of await confirm.getByRole('checkbox').all()) await checkbox.uncheck();
    await confirm.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect.poll(() => saves.length).toBe(2);
    await expect(confirm).toBeHidden();
    expect(state.businessWrites).toEqual([]);
    expect(state.pageErrors).toEqual([]);
  });
}
