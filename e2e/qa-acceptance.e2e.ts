import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  PHOTO_EDITOR_EMAIL,
  PHOTO_EDITOR_PASSWORD,
  VIDEO_EDITOR_EMAIL,
  VIDEO_EDITOR_PASSWORD,
  loginAsEditor,
} from './helpers/auth';

const API_BASE_URL = process.env.E2E_API_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const EXTERNAL_BOOKING_API_KEY = process.env.E2E_EXTERNAL_BOOKING_API_KEY ?? '';
const QA_RUN_ID = process.env.E2E_QA_RUN_ID ?? new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const TEST_SHOOT_SCOPES = [
  {
    kind: process.env.E2E_TEST_SHOOT_REGION_KIND ?? 'region',
    value: process.env.E2E_TEST_SHOOT_REGION_VALUE ?? 'Northeast',
    timezone: process.env.E2E_TEST_SHOOT_REGION_TIMEZONE ?? 'America/New_York',
  },
  {
    kind: process.env.E2E_TEST_SHOOT_STATE_KIND ?? 'state',
    value: process.env.E2E_TEST_SHOOT_STATE_VALUE ?? 'MD',
    timezone: process.env.E2E_TEST_SHOOT_STATE_TIMEZONE ?? 'America/New_York',
  },
  {
    kind: process.env.E2E_TEST_SHOOT_AREA_KIND ?? 'area',
    value: process.env.E2E_TEST_SHOOT_AREA_VALUE ?? 'DC Metro',
    timezone: process.env.E2E_TEST_SHOOT_AREA_TIMEZONE ?? 'America/New_York',
  },
];

async function isLovableLoginWall(page: Page) {
  const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
  return /lovable/i.test(page.url()) && /continue with google|continue with github|create your account/i.test(bodyText);
}

async function loginForToken(request: APIRequestContext) {
  const login = await request.post(`${API_BASE_URL}/api/login`, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  expect(login.ok(), `Admin API login failed with ${login.status()}`).toBeTruthy();
  const body = await login.json();
  expect(body.token, 'Admin API login did not return a token').toBeTruthy();

  return String(body.token);
}

async function firstExternalServiceId(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/api/external/services`, {
    headers: { 'X-API-Key': EXTERNAL_BOOKING_API_KEY },
  });
  expect(response.ok(), `External services request failed with ${response.status()}`).toBeTruthy();

  const body = await response.json();
  const service = body.data?.[0];
  expect(service?.id, 'External services response did not include a service id').toBeTruthy();

  return service.id;
}

test.describe('QA acceptance flows', () => {
  test('public booking page does not require account creation before submit', async ({ page }) => {
    await page.goto('/book', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);

    if (await isLovableLoginWall(page)) {
      test.skip(true, 'Preview is behind Lovable auth; provide E2E_PREVIEW_STORAGE_STATE to verify the public booking UI.');
    }

    await page.screenshot({
      path: '../output/playwright/qa-public-booking-before-submit.png',
      fullPage: true,
    });

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/your information|book|shoot|schedule/i);
    expect(bodyText).not.toMatch(/create your account|sign up to continue|log in to book/i);
  });

  test('external guest booking creates an account-backed requested shoot', async ({ request }) => {
    test.skip(
      !EXTERNAL_BOOKING_API_KEY,
      'Set E2E_EXTERNAL_BOOKING_API_KEY to run the data-creating external guest booking check.',
    );

    const serviceId = await firstExternalServiceId(request);
    const email = `qa.external.${QA_RUN_ID}@example.test`;

    const response = await request.post(`${API_BASE_URL}/api/external/book-shoot`, {
      headers: { 'X-API-Key': EXTERNAL_BOOKING_API_KEY },
      data: {
        client_name: `QA External ${QA_RUN_ID}`,
        client_email: email,
        client_phone: '555-0100',
        address: `QA ${QA_RUN_ID} Guest Booking Ave`,
        city: 'Baltimore',
        state: 'MD',
        zip: '21201',
        preferred_date: '2026-07-15',
        preferred_time: '10:00',
        services: [{ id: serviceId, quantity: 1 }],
        notes: `QA acceptance guest booking ${QA_RUN_ID}`,
        source: 'playwright_qa_acceptance',
        create_account: true,
      },
    });

    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json();
    expect(body.data.status).toBe('requested');
    expect(body.data.client_id).toBeTruthy();
    expect(body.data.is_new_client).toBe(true);
    expect(body.data.account_created).toBe(true);
    expect(body.data.account_setup_required).toBe(true);
    expect(body.data.is_guest_booking).toBe(false);

    const check = await request.post(`${API_BASE_URL}/api/external/check-client`, {
      headers: { 'X-API-Key': EXTERNAL_BOOKING_API_KEY },
      data: { email },
    });
    expect(check.ok(), await check.text()).toBeTruthy();
    const checkBody = await check.json();
    expect(checkBody).toEqual(expect.objectContaining({ exists: true }));
  });

  test('external guest booking can opt out of dashboard account setup', async ({ request }) => {
    test.skip(
      !EXTERNAL_BOOKING_API_KEY,
      'Set E2E_EXTERNAL_BOOKING_API_KEY to run the data-creating guest opt-out booking check.',
    );

    const serviceId = await firstExternalServiceId(request);
    const email = `qa.external.guest.${QA_RUN_ID}@example.test`;

    const response = await request.post(`${API_BASE_URL}/api/external/book-shoot`, {
      headers: { 'X-API-Key': EXTERNAL_BOOKING_API_KEY },
      data: {
        client_name: `QA Guest ${QA_RUN_ID}`,
        client_email: email,
        client_phone: '555-0101',
        address: `QA ${QA_RUN_ID} Guest Opt Out Ave`,
        city: 'Baltimore',
        state: 'MD',
        zip: '21201',
        preferred_date: '2026-07-16',
        preferred_time: '11:00',
        services: [{ id: serviceId, quantity: 1 }],
        notes: `QA acceptance guest account opt-out ${QA_RUN_ID}`,
        source: 'playwright_qa_acceptance',
        create_account: false,
      },
    });

    expect(response.status(), await response.text()).toBe(201);
    const body = await response.json();
    expect(body.data.status).toBe('requested');
    expect(body.data.client_id).toBeTruthy();
    expect(body.data.is_new_client).toBe(false);
    expect(body.data.account_created).toBe(false);
    expect(body.data.account_setup_required).toBe(false);
    expect(body.data.is_guest_booking).toBe(true);
  });

  test('photo and video editor accounts authenticate and render assigned-work dashboards', async ({ page }) => {
    await loginAsEditor(page, PHOTO_EDITOR_EMAIL, PHOTO_EDITOR_PASSWORD);
    await page.screenshot({
      path: '../output/playwright/qa-photo-editor-dashboard.png',
      fullPage: true,
    });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: /assign photographer/i })).toHaveCount(0);

    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    await loginAsEditor(page, VIDEO_EDITOR_EMAIL, VIDEO_EDITOR_PASSWORD);
    await page.screenshot({
      path: '../output/playwright/qa-video-editor-dashboard.png',
      fullPage: true,
    });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('button', { name: /assign photographer/i })).toHaveCount(0);
  });

  test('test-shoot simulator covers region, state, and area photographer scopes', async ({ request }) => {
    const token = await loginForToken(request);
    const createdShootIds: Array<number | string> = [];

    for (const [index, scope] of TEST_SHOOT_SCOPES.entries()) {
      const scheduledAt = `2026-08-${String(10 + index).padStart(2, '0')}T14:00:00Z`;
      const create = await request.post(`${API_BASE_URL}/api/admin/test-shoots`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          kind: scope.kind,
          value: scope.value,
          timezone: scope.timezone,
          scheduled_at: scheduledAt,
        },
      });

      expect(create.status(), await create.text()).toBe(201);
      const createBody = await create.json();
      createdShootIds.push(createBody.shoot.id);
      expect(createBody.shoot.shoot_type).toBe('internal_test');
      expect(createBody.shoot.service_area_kind).toBe(scope.kind);
      expect(createBody.shoot.service_area_value).toBe(scope.value);

      const eligible = await request.get(
        `${API_BASE_URL}/api/admin/test-shoots/${createBody.shoot.id}/eligible-photographers`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      expect(eligible.ok(), await eligible.text()).toBeTruthy();
      const eligibleBody = await eligible.json();
      expect(eligibleBody.service_area).toEqual(expect.objectContaining({
        kind: scope.kind,
        value: scope.value,
      }));
      expect(Array.isArray(eligibleBody.photographers)).toBe(true);
    }

    expect(createdShootIds).toHaveLength(TEST_SHOOT_SCOPES.length);
  });
});
