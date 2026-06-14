import { expect, test, type Page } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './helpers/auth';

/**
 * QA #16 — Lock an account / convert account type (functional confirmation).
 *
 * The row-menu controls exist (Account Status + Convert Account Type). This spec
 * verifies they actually work end-to-end against the REAL API:
 *   16a  Locking an account blocks that account from authenticating (login 403 /
 *        existing token 401).
 *   16b  Converting an account's type actually changes its stored role.
 *
 * Uses a DISPOSABLE account so the mutations are safe to run for real:
 *   • E2E_LOCK_TARGET_EMAIL / E2E_LOCK_TARGET_PASSWORD — a throwaway account.
 *   • E2E_CONVERT_TARGET_ROLE — role to convert it to (default "photographer").
 *   When the env is unset the spec skips (it must not be faked).
 *
 * Runs HEADLESS. Targets real routes/controls so a green run is a genuine verification.
 */

const TARGET_EMAIL = process.env.E2E_LOCK_TARGET_EMAIL ?? '';
const TARGET_PASSWORD = process.env.E2E_LOCK_TARGET_PASSWORD ?? '';
const CONVERT_ROLE = process.env.E2E_CONVERT_TARGET_ROLE ?? 'photographer';
const API_BASE = process.env.E2E_API_BASE_URL ?? process.env.E2E_BASE_URL ?? '';

async function authToken(page: Page): Promise<string | null> {
  return page.evaluate(
    () => localStorage.getItem('authToken') || localStorage.getItem('token'),
  );
}

function apiBaseFrom(page: Page): string {
  const base = API_BASE || page.url().replace(/\/[^/]*$/, '');
  return base.replace(/\/$/, '');
}

async function resolveUserId(
  request: import('@playwright/test').APIRequestContext,
  apiBase: string,
  adminToken: string,
  email: string,
): Promise<string | null> {
  const res = await request.get(`${apiBase}/api/admin/users?light=1`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const body = await res.json();
  const rows = Array.isArray(body) ? body : body?.data ?? [];
  const match = rows.find((u: any) => String(u.email).toLowerCase() === email.toLowerCase());
  return match ? String(match.id) : null;
}

test.describe('QA #16 — lock + convert account', () => {
  test('locking an account blocks its authentication', async ({ page, request }) => {
    test.skip(
      !TARGET_EMAIL || !TARGET_PASSWORD,
      'Set E2E_LOCK_TARGET_EMAIL / E2E_LOCK_TARGET_PASSWORD to a disposable account.',
    );

    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const apiBase = apiBaseFrom(page);
    const adminToken = await authToken(page);
    expect(adminToken).toBeTruthy();

    const userId = await resolveUserId(request, apiBase, adminToken!, TARGET_EMAIL);
    test.skip(!userId, 'Disposable account not found in the directory.');

    // Lock the account.
    const lock = await request.patch(`${apiBase}/api/admin/users/${userId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: 'application/json' },
      data: { status: 'locked' },
    });
    expect(lock.ok(), `Lock failed with ${lock.status()}`).toBeTruthy();

    // A locked account must not be able to authenticate.
    const loginAttempt = await request.post(`${apiBase}/api/login`, {
      headers: { Accept: 'application/json' },
      data: { email: TARGET_EMAIL, password: TARGET_PASSWORD },
    });
    expect(
      loginAttempt.status(),
      'A locked account must be denied login (expected 401/403).',
    ).toBeGreaterThanOrEqual(401);
    expect(loginAttempt.status()).toBeLessThan(500);

    // Cleanup: restore the account to active so the fixture is reusable. (Restore
    // forces a credential refresh by design, so we do not re-assert login here.)
    await request.patch(`${apiBase}/api/admin/users/${userId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: 'application/json' },
      data: { status: 'active' },
    });
  });

  test('converting an account type changes its role', async ({ page, request }) => {
    test.skip(
      !TARGET_EMAIL,
      'Set E2E_LOCK_TARGET_EMAIL to a disposable account to verify conversion.',
    );

    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const apiBase = apiBaseFrom(page);
    const adminToken = await authToken(page);
    expect(adminToken).toBeTruthy();

    const userId = await resolveUserId(request, apiBase, adminToken!, TARGET_EMAIL);
    test.skip(!userId, 'Disposable account not found in the directory.');

    const convert = await request.patch(`${apiBase}/api/admin/users/${userId}/convert-type`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: 'application/json' },
      data: { role: CONVERT_ROLE, account_type: CONVERT_ROLE },
    });
    expect(convert.ok(), `Convert failed with ${convert.status()}`).toBeTruthy();

    // Confirm the stored role actually changed.
    const list = await request.get(`${apiBase}/api/admin/users?light=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await list.json();
    const rows = Array.isArray(body) ? body : body?.data ?? [];
    const updated = rows.find((u: any) => String(u.id) === String(userId));
    expect(String(updated?.role)).toBe(CONVERT_ROLE);
  });
});
