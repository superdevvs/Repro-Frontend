import { expect, test } from '@playwright/test';
import { installShootDetailsWorkspaceFixture } from './helpers/shoot-details-workspace-fixture';

test.use({ timezoneId: 'Asia/Kolkata', video: 'off' });
for (const width of [1440, 390]) for (const outside of [true, false]) {
  test(`${outside ? 'confirms exception' : 'uses adjacent availability'} for 4:30 PM reschedule at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-10-20T18:00:00Z'));
    const fixture = await installShootDetailsWorkspaceFixture(page, baseURL, 'admin', 'light');
    const shoot = { ...fixture.shoot, status: 'scheduled', workflow_status: 'scheduled', address: '14718 Beaumeadow Drive',
      scheduled_at: '2026-10-20T21:00:00Z', scheduled_instant: '2026-10-20T21:00:00Z', scheduled_date: '2026-10-20', time: '17:00',
      photographer_id: 21, service_items: [{ id: 3001, service_id: 101, duration_minutes: 35, photographer_id: 21, scheduled_at: '2026-10-20T21:00:00Z', workflow_status: 'scheduled' }],
      services: [{ id: 101, name: 'HDR Photos', duration_minutes: 35, photographer_required: true, photographer_id: 21, price: 100, workflow_status: 'scheduled' }] };
    const saves: Record<string, unknown>[] = [];
    await page.addInitScript(() => { const user = JSON.parse(localStorage.getItem('user') || '{}'); user.role = 'superadmin'; localStorage.setItem('user', JSON.stringify(user)); });
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
      if (path === '/user') return route.fulfill({ json: { id: 901, name: 'Local Superadmin', email: 'qa@example.test', role: 'superadmin', account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } } });
      if (path === '/shoots/156') return route.fulfill({ json: { data: shoot } });
      if (path === '/shoots') return route.fulfill({ json: { data: [shoot], meta: { total: 1, current_page: 1, last_page: 1 } } });
      if (path.endsWith('/feasibility')) return route.fulfill({ json: { data: { enabled: true, available: !outside, status: outside ? 'conflict' : 'available',
        can_override: false, can_override_working_hours: outside, working_hours_confirmation_version: outside ? 'signed-reschedule-fixture' : undefined,
        reason_codes: outside ? ['outside_working_hours'] : [], transitions: [], alternatives: [], policy_version: '1', schedule_version: '1',
        visits: [{ photographer_id: 21, start: '2026-10-20T20:30:00Z', end: '2026-10-20T21:05:00Z', scheduled_at: '2026-10-20T20:30:00Z', duration_minutes: 35, timezone: 'America/New_York' }] } } });
      if (path === '/shoots/156/reschedule') { saves.push(route.request().postDataJSON()); return route.fulfill({ status: 201, json: { applied: true } }); }
      return route.fallback();
    });
    await page.goto('/shoots/156');
    await expect(page.getByRole('dialog', { name: /#156/ })).toBeVisible();
    await page.keyboard.press('Escape');
    if (width < 1024) await page.locator('.shoot-workspace-mobile-record > summary').click();
    await page.getByRole('button', { name: 'Reschedule', exact: true }).filter({ visible: true }).click();
    const editor = page.getByRole('dialog', { name: 'Reschedule Shoot', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Type time', exact: true }).click();
    await editor.getByLabel('Exact time', { exact: true }).fill('4:30 PM');
    await editor.getByRole('button', { name: 'Apply', exact: true }).click();
    const submit = editor.getByRole('button', { name: 'Reschedule Shoot', exact: true });
    await expect(submit).toBeEnabled(); await submit.click();
    if (outside) {
      const confirm = page.getByRole('dialog', { name: 'Save outside working hours', exact: true });
      await expect(confirm).toBeVisible();
      await expect(confirm.getByRole('region', { name: 'Appointment outside working hours' })).toContainText('4:30 PM EDT');
      expect(saves).toHaveLength(0);
      await confirm.getByLabel('Working-hours exception reason').fill('Photographer approved this reschedule.');
      const save = confirm.getByRole('button', { name: 'Confirm and save outside hours' });
      await save.scrollIntoViewIfNeeded();
      if (process.env.BOOKING_QA_OUTPUT) await page.screenshot({ path: `${process.env.BOOKING_QA_OUTPUT}/reschedule-hours-${width}.png` });
      await save.click();
    }
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0]).toMatchObject({ requested_date: '2026-10-20', requested_time: '16:30' });
    if (outside) expect(saves[0]).toMatchObject({ working_hours_override: true, working_hours_override_confirmed: true, working_hours_override_confirmation_version: 'signed-reschedule-fixture' });
    else expect(saves[0]).not.toHaveProperty('working_hours_override');
    expect(fixture.pageErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
