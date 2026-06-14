import { expect, test, type Page } from '@playwright/test';

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from './helpers/auth';

/**
 * QA #15 — Deleted account: cache eviction + access revocation.
 *
 * Two findings are covered:
 *   15a  A deleted account "lingers in cache" — it must disappear from the accounts
 *        list and photographer directory immediately (no list-cache TTL window).
 *   15b  A deleted account must NOT be able to keep using the system — its existing
 *        auth token must be revoked the moment it is deleted (subsequent API calls
 *        return 401).
 *
 * The spec uses a DISPOSABLE account so the delete is safe to run for real:
 *   • E2E_DELETE_TARGET_EMAIL / E2E_DELETE_TARGET_PASSWORD — a throwaway account
 *     (ideally a photographer, so the directory-cache check is meaningful) that the
 *     suite is allowed to delete. When unset the spec skips (it must not be faked).
 *
 * Flow: log the disposable account in to mint a real token → confirm it works and the
 * account is listed → as admin, delete it → confirm its token is now 401 and it is
 * gone from the directory.
 *
 * Runs HEADLESS. Targets real routes/controls so a green run is a genuine verification.
 */

const TARGET_EMAIL = process.env.E2E_DELETE_TARGET_EMAIL ?? '';
const TARGET_PASSWORD = process.env.E2E_DELETE_TARGET_PASSWORD ?? '';
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

test.describe('QA #15 — deleted account cache + access', () => {
  test('a deleted account is evicted from caches and can no longer access the system', async ({
    page,
    context,
    request,
  }) => {
    test.skip(
      !TARGET_EMAIL || !TARGET_PASSWORD,
      'Set E2E_DELETE_TARGET_EMAIL / E2E_DELETE_TARGET_PASSWORD to a disposable account.',
    );

    // 1) Mint a real token for the disposable account in a separate context.
    const victimPage = await context.newPage();
    await victimPage.goto('/');
    await victimPage.getByPlaceholder('Email').fill(TARGET_EMAIL);
    await victimPage.getByPlaceholder('Password').fill(TARGET_PASSWORD);
    await victimPage.getByRole('button', { name: 'Log In' }).click();
    await expect(victimPage).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    const apiBase = apiBaseFrom(victimPage);
    const victimToken = await authToken(victimPage);
    expect(victimToken, 'Disposable account must mint a token').toBeTruthy();

    // 15b precondition — the victim token works before deletion.
    const before = await request.get(`${apiBase}/api/user`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    expect(before.ok(), 'Victim token should work before deletion').toBeTruthy();
    const victimId = (await before.json())?.id;
    expect(victimId, 'Could not resolve victim user id').toBeTruthy();

    // 2) As admin, confirm the account is listed, then delete it.
    await loginAsAdmin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminToken = await authToken(page);
    expect(adminToken).toBeTruthy();

    const listBefore = await request.get(`${apiBase}/api/admin/users?light=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersBefore = await listBefore.json();
    const rowsBefore = Array.isArray(usersBefore) ? usersBefore : usersBefore?.data ?? [];
    expect(
      rowsBefore.some((u: any) => String(u.id) === String(victimId)),
      'Disposable account should be listed before deletion',
    ).toBe(true);

    const del = await request.delete(`${apiBase}/api/admin/users/${victimId}`, {
      headers: { Authorization: `Bearer ${adminToken}`, Accept: 'application/json' },
    });
    expect(del.ok(), `Delete failed with ${del.status()}`).toBeTruthy();

    // 15b — the victim token must be revoked immediately.
    const after = await request.get(`${apiBase}/api/user`, {
      headers: { Authorization: `Bearer ${victimToken}` },
    });
    expect(
      after.status(),
      'Deleted account token must be rejected (401)',
    ).toBe(401);

    // 15a — the account must be gone from the directory immediately (cache busted).
    const listAfter = await request.get(`${apiBase}/api/admin/users?light=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersAfter = await listAfter.json();
    const rowsAfter = Array.isArray(usersAfter) ? usersAfter : usersAfter?.data ?? [];
    expect(
      rowsAfter.some((u: any) => String(u.id) === String(victimId)),
      'Deleted account must not appear in the directory after deletion',
    ).toBe(false);

    await victimPage.close();
  });
});
