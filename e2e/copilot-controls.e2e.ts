import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const features = [
  ['shoots', 'Shoot search'], ['operations', 'Operations brief'], ['booking', 'Booking'],
  ['reschedule', 'Rescheduling'], ['notes', 'Shoot notes'], ['watches', 'Shoot watches'],
  ['finance', 'Accounting reports'], ['studio', 'Studio status'], ['marketing', 'Listing and client insights'], ['support', 'Workflow help'],
].map(([key, label]) => ({ key, label, description: `Control ${label.toLowerCase()} access.` }));

async function fixture(page: Page, baseURL: string | undefined, canManage = true, failSave = false) {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Copilot fixtures require a loopback preview.');
  const actor = { id: '900099', name: 'Copilot QA', email: 'copilot@example.test', role: 'admin', account_status: 'active',
    email_verified_at: '2026-01-01T00:00:00Z', metadata: { terms_accepted_at: '2026-01-01T00:00:00Z', preferences: {} } };
  await page.addInitScript(user => {
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('authToken', 'local-copilot-fixture-not-a-real-token');
    localStorage.setItem('repro:user-profile:last-fetch-at', String(Date.now()));
  }, actor);
  let settings = { enabled: true, allow_changes: true, listing_url: '', features: Object.fromEntries(features.map(f => [f.key, true])) };
  let version = 'a'.repeat(64);
  const writes: { method: string; path: string; body: unknown }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let connections = [{ id: 'connection-qa', name: 'ChatGPT QA', scopes: 'repro.read repro.write', created_at: '2026-10-09T10:00:00Z' }];
  await page.route('**/api/**', async route => {
    const req = route.request(); const pathname = new URL(req.url()).pathname;
    let body: unknown = { data: [] }; let status = 200;
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS' && pathname !== '/api/system-telemetry/events') writes.push({ method: req.method(), path: pathname, body: req.postData() ? req.postDataJSON() : null });
    if (pathname === '/api/account-links/has-linked') body = { has_linked_accounts: false };
    if (pathname === '/api/user') body = actor;
    if (pathname === '/api/me/permissions') body = { permissions: ['settings', 'dashboard', 'integrations'].flatMap(resource => ['view', 'edit'].map(action => ({ resource, action }))), permissionIds: [] };
    if (pathname.includes('/voice/browser/config')) body = { ready: false, blockers: [], presence_verification: 'provider' };
    if (pathname.includes('/admin/settings/')) body = { data: { value: {} } };
    if (pathname === '/api/copilot/settings') {
      if (req.method() === 'PUT') {
        if (failSave) { status = 409; body = { message: 'Copilot settings changed. Reload before saving.' }; }
        else { const input = req.postDataJSON(); settings = { enabled: input.enabled, allow_changes: input.allow_changes, listing_url: input.listing_url, features: input.features }; version = 'b'.repeat(64); }
      }
      if (status === 200) body = { data: { settings, version, can_manage: canManage, features, connection_url: settings.listing_url || 'https://chatgpt.com/plugins',
        connection_mode: settings.listing_url ? 'listing' : 'setup', mcp_url: 'https://reprodashboard.com/api/copilot/mcp' } };
    }
    if (pathname === '/api/copilot/oauth/connections') body = { data: connections };
    if (pathname === '/api/copilot/oauth/connections/connection-qa' && req.method() === 'DELETE') { connections = []; body = { success: true }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { writes, errors };
}

for (const width of [390, 1280]) {
  test(`controls save, persist and revoke only the selected connection at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page, baseURL);
    await page.goto('/settings?tab=integrations&integration=copilot');
    await expect(page.getByRole('switch', { name: 'Enable Repro Copilot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Settings', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open ChatGPT', exact: true })).toHaveAttribute('href', 'https://chatgpt.com/plugins');
    await expect(page.getByText(/published Repro App Store listing has not been configured/)).toBeVisible();
    if (process.env.REPRO_COPILOT_ARTIFACTS) {
      await page.getByRole('tab', { name: 'ChatGPT', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.env.REPRO_COPILOT_ARTIFACTS, `copilot-header-${width}.png`), animations: 'disabled' });
    }
    await page.getByRole('switch', { name: 'Allow reviewed changes' }).click();
    await page.getByRole('switch', { name: 'Shoot notes', exact: true }).click();
    await page.getByRole('button', { name: 'Save Copilot controls' }).click();
    await expect(page.getByText(/Copilot controls saved/)).toBeVisible();
    expect(state.writes[0]).toMatchObject({ path: '/api/copilot/settings', method: 'PUT', body: { allow_changes: false, features: { notes: false }, version: 'a'.repeat(64) } });
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Shoot notes', exact: true })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('switch', { name: 'Allow reviewed changes' })).toHaveAttribute('aria-checked', 'false');
    await page.getByRole('switch', { name: 'Enable Repro Copilot' }).click();
    await expect(page.getByRole('switch', { name: 'Booking', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Save Copilot controls' }).click();
    await expect(page.getByRole('button', { name: 'Enable Copilot to connect' })).toBeDisabled();
    await page.getByRole('button', { name: 'Revoke access' }).click();
    await expect(page.getByText('No active ChatGPT connections for your Repro account.')).toBeVisible();
    expect(state.writes.map(write => write.path)).toEqual(['/api/copilot/settings', '/api/copilot/settings', '/api/copilot/oauth/connections/connection-qa']);
    await page.getByRole('switch', { name: 'Enable Repro Copilot' }).click();
    await page.getByRole('button', { name: 'Save Copilot controls' }).click();
    await expect(page.getByRole('link', { name: 'Open ChatGPT', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (process.env.REPRO_COPILOT_ARTIFACTS) await page.screenshot({ path: path.join(process.env.REPRO_COPILOT_ARTIFACTS, `copilot-controls-${width}.png`), fullPage: true, animations: 'disabled' });
    expect(state.errors).toEqual([]);
  });
}

test('listing destination becomes active only after a successful save', async ({ page, baseURL }) => {
  await fixture(page, baseURL);
  await page.goto('/settings?tab=integrations&integration=copilot');
  await page.getByLabel('Published ChatGPT App Store listing URL').fill('https://chatgpt.com/plugins/repro-qa');
  await expect(page.getByRole('link', { name: 'Open ChatGPT', exact: true })).toHaveAttribute('href', 'https://chatgpt.com/plugins');
  await page.getByRole('button', { name: 'Save Copilot controls' }).click();
  await expect(page.getByRole('link', { name: 'Connect in ChatGPT App Store' })).toHaveAttribute('href', 'https://chatgpt.com/plugins/repro-qa');
});

test('conflicting save keeps unsaved controls and exposes reload without false success', async ({ page, baseURL }) => {
  await fixture(page, baseURL, true, true);
  await page.goto('/settings?tab=integrations&integration=copilot');
  await page.getByRole('switch', { name: 'Enable Repro Copilot' }).click();
  await page.getByRole('button', { name: 'Save Copilot controls' }).click();
  await expect(page.getByRole('alert')).toContainText('Copilot settings changed');
  await expect(page.getByRole('switch', { name: 'Enable Repro Copilot' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText(/Copilot controls saved/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reload controls' }).click();
  await expect(page.getByRole('switch', { name: 'Enable Repro Copilot' })).toHaveAttribute('aria-checked', 'true');
});

test('view-only permission does not expose global editing but keeps own revoke available', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, false);
  await page.goto('/settings?tab=integrations&integration=copilot');
  await expect(page.getByRole('switch', { name: 'Enable Repro Copilot' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Allow reviewed changes' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save Copilot controls' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revoke access' })).toBeEnabled();
  expect(state.writes).toEqual([]);
});
