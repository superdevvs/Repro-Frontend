import { test, expect, type Page } from '@playwright/test';

/**
 * Team onboarding flow — admin-create end-to-end check.
 *
 * Runs in a REAL, VISIBLE Google Chrome window (channel 'chrome', headed) so the
 * admin login and account creation are observable.
 *
 * Flow:
 *   1. Log in as a seeded admin through the actual login form.
 *   2. As that admin, create one account per role via POST /api/admin/users
 *      (the exact call site this feature changed — Admin/UserController@store),
 *      using the browser's authenticated session token.
 *   3. Assert each newly created account received the correct role-keyed
 *      dashboard onboarding block with source 'admin_account_created'.
 *   4. Assert a non-onboarded role (admin) receives NO onboarding block.
 */

test.use({ channel: 'chrome', headless: false });

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'creator@reprophotos.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ReCreate1!';

// role -> preference key the backend writes under metadata.preferences
const ONBOARDED_ROLES: Record<string, string> = {
  photographer: 'photographerDashboardOnboarding',
  salesRep: 'salesRepDashboardOnboarding',
  editing_manager: 'editingManagerDashboardOnboarding',
  editor: 'editorDashboardOnboarding',
  client: 'clientDashboardOnboarding',
};

async function loginAsAdmin(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByPlaceholder('Email').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

  // The app persists the bearer token in localStorage.
  const token = await page.evaluate(
    () => localStorage.getItem('authToken') || localStorage.getItem('token'),
  );
  expect(token, 'auth token should be present after login').toBeTruthy();
  return token as string;
}

test('admin-created accounts receive correct role-aware onboarding eligibility', async ({ page }) => {
  const token = await loginAsAdmin(page);
  const stamp = Date.now();

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  // 1) Each onboarded role gets a role-keyed block with source 'admin_account_created'.
  for (const [role, key] of Object.entries(ONBOARDED_ROLES)) {
    const email = `qa.onboard.${role.toLowerCase()}.${stamp}@example.com`;
    const res = await page.request.post('/api/admin/users', {
      headers: authHeaders,
      data: {
        name: `QA Onboard ${role}`,
        email,
        role,
        account_status: 'active',
      },
    });

    expect(res.status(), `${role} create should return 201`).toBe(201);
    const body = await res.json();
    const block = body?.user?.metadata?.preferences?.[key];

    expect(block, `${role}: ${key} block should exist`).toBeTruthy();
    expect(block.eligible, `${role}: eligible`).toBe(true);
    expect(typeof block.version, `${role}: version is number`).toBe('number');
    expect(block.version, `${role}: version >= 1`).toBeGreaterThanOrEqual(1);
    expect(block.source, `${role}: source`).toBe('admin_account_created');
    expect(block.createdAt, `${role}: createdAt set`).toBeTruthy();

    console.log(`[OK] ${role} -> ${key}:`, JSON.stringify(block));
  }

  // 2) A non-onboarded role (admin) must NOT receive any onboarding block.
  const adminEmail = `qa.onboard.adminrole.${stamp}@example.com`;
  const adminRes = await page.request.post('/api/admin/users', {
    headers: authHeaders,
    data: {
      name: 'QA Onboard adminrole',
      email: adminEmail,
      role: 'admin',
      account_status: 'active',
    },
  });
  expect(adminRes.status(), 'admin-role create should return 201').toBe(201);
  const adminBody = await adminRes.json();
  const prefs = adminBody?.user?.metadata?.preferences ?? {};
  const onboardingKeys = Object.values(ONBOARDED_ROLES);
  for (const key of onboardingKeys) {
    expect(prefs[key], `admin role must not have ${key}`).toBeUndefined();
  }
  console.log('[OK] admin role -> no onboarding block, preferences:', JSON.stringify(prefs));
});
