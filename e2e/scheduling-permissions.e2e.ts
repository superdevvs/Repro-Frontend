import { expect, test } from '@playwright/test';
import path from 'node:path';
import { installShootDetailsWorkspaceFixture, workspaceAddress } from './helpers/shoot-details-workspace-fixture';

test.use({ timezoneId: 'America/New_York', video: 'off' });

for (const role of ['admin', 'salesRep'] as const) for (const width of [1440, 390]) {
  test(`${role} can find Delmar after availability fails at ${width}px without bypassing save checks`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const fixture = await installShootDetailsWorkspaceFixture(page, baseURL, role, 'light', { salesRepManagement: true });
    const service = { ...fixture.shoot.services[0], workflow_status: 'scheduled', delivery_status: 'not_started', photographer_id: 21, duration_minutes: 45, photographer_required: true };
    const shoot = { ...fixture.shoot, status: 'scheduled', workflow_status: 'scheduled', scheduled_at: '2026-11-04T18:00:00Z', scheduled_instant: '2026-11-04T18:00:00Z',
      scheduled_date: '2026-11-04', time: '13:00', latitude: 39.3, longitude: -76.6,
      canManageBooking: true, canManageShootActions: true, canEditAppointment: true, canReassignPhotographer: true,
      canScheduleShoot: true, canApproveReschedule: true, canReviewRequests: true, canRequestReschedule: false,
      services: [service], service_items: [{ id: 3001, service_id: service.id, photographer_id: 21, duration_minutes: 45, scheduled_at: '2026-11-04T18:00:00Z', workflow_status: 'scheduled' }] };
    const people = [{ id: 21, name: 'Harrison Hart' }, { id: 1136, name: 'Delmar Harrod' }];
    let previewFails = true;
    let previewRequests = 0;
    const writes: string[] = [];
    await page.route('**/api/**', async route => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname.replace(/^\/api/, '');
      if (endpoint === '/shoots/156' && request.method() === 'GET') return route.fulfill({ json: { data: shoot } });
      if (endpoint === '/services' || endpoint === '/admin/services') return route.fulfill({ json: { data: [service] } });
      if (endpoint === '/photographers') return route.fulfill({ json: { data: people } });
      if (endpoint === '/photographer/availability/for-booking') {
        previewRequests++;
        return previewFails
          ? route.fulfill({ status: 503, json: { message: 'Temporary preview outage' } })
          : route.fulfill({ json: { data: people.map(person => ({ ...person, net_available_slots: [], booked_slots: [], unavailable_slots: [] })) } });
      }
      if (endpoint === '/photographer/availability/feasibility') return route.fulfill({ status: 503, json: { message: 'Temporary scheduling outage' } });
      if (endpoint === '/photographer/availability/check') return route.fulfill({ json: { data: [{ start_time: '08:00', end_time: '14:30', status: 'available' }] } });
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method()) && /^\/shoots\/156(?:\/|$)/.test(endpoint)) {
        writes.push(endpoint);
        return route.fulfill({ status: 409, json: { message: 'No business writes are permitted in this fixture.' } });
      }
      return route.fallback();
    });
    await page.goto('/shoots/156');
    const overview = page.getByRole('dialog', { name: `#156 · ${workspaceAddress}`, exact: true });
    await expect(overview).toBeVisible();
    if (width < 640) {
      await overview.getByRole('button', { name: 'More actions', exact: true }).click();
      await page.getByRole('button', { name: 'Edit shoot', exact: true }).click();
    } else await overview.getByRole('button', { name: 'Edit', exact: true }).click();
    await overview.getByTestId('photographer-cell').first().click();
    const picker = page.getByRole('dialog', { name: /^Select Photographer/ });
    await expect(picker).toBeVisible();
    await expect(picker.getByText('Delmar Harrod', { exact: true })).toBeVisible();
    await expect(picker.getByText('Availability check failed', { exact: true }).first()).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Available only', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await picker.getByPlaceholder('Search by name or area...').fill('Delmar');
    await expect(picker.getByText('Delmar Harrod', { exact: true })).toBeVisible();
    previewFails = false;
    await picker.getByRole('button', { name: /Retry/ }).click();
    await expect.poll(() => previewRequests).toBeGreaterThan(1);
    await expect(picker.getByText('No available times for this visit', { exact: true })).toBeVisible();
    await expect(picker.getByText('Delmar Harrod', { exact: true })).toBeVisible();
    if (process.env.E2E_SHOOT_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.E2E_SHOOT_SCREENSHOT_DIR, `picker-${role}-${width}.png`) });
    await picker.getByRole('button', { name: /Delmar Harrod/ }).click();
    await picker.getByRole('button', { name: 'Use selection', exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(overview.getByText(/server error 503/).first()).toBeVisible();
    // Selection feedback can overlap the mobile footer until dismissed.
    for (const close of await page.locator('[toast-close]').all()) await close.click();
    await overview.getByRole('button', { name: 'Save Changes', exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole('dialog', { name: 'Confirm update', exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(fixture.businessWrites).toEqual([]);
    expect(fixture.pageErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
