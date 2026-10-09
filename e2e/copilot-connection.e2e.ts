import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const requestId = '11111111-1111-4111-8111-111111111111';
const actor = { id: '900051', name: 'Repro Test Client', email: 'client@example.test', role: 'client',
  account_status: 'active', email_verified_at: '2026-01-01T00:00:00Z', metadata: { terms_accepted_at: '2026-01-01T00:00:00Z' } };

async function fixture(page: Page, baseURL: string | undefined) {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Connection fixtures require a loopback preview.');
  const writes: { path: string; method: string; body: string | null }[] = [];
  await page.addInitScript(user => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('authToken', 'local-copilot-fixture-not-a-real-token');
    localStorage.setItem('repro:user-profile:last-fetch-at', String(Date.now()));
    localStorage.setItem('theme', 'light');
  }, actor);
  await page.route('**/api/**', async route => {
    const request = route.request(); const pathname = new URL(request.url()).pathname;
    if (!['GET', 'OPTIONS'].includes(request.method())) writes.push({ path: pathname, method: request.method(), body: request.postData() });
    let body: unknown = { data: [] };
    if (pathname === '/api/user') body = { data: actor };
    if (pathname.includes('/copilot/oauth/requests/')) body = request.method() === 'GET'
      ? { request_id: requestId, client_name: 'ChatGPT', scopes: ['repro.read', 'repro.write'], omitted_scopes: ['repro.finance'], account: actor, expires_at: '2030-10-09T12:00:00Z' }
      : { redirect_url: 'https://chatgpt.com/connector/oauth/test?code=local-fixture&state=fixture-state' };
    if (pathname === '/api/copilot/oauth/connections') body = { data: [{ id: requestId, name: 'ChatGPT', scopes: 'repro.read repro.write', created_at: '2026-10-09T00:00:00Z' }] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route('https://chatgpt.com/connector/oauth/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Returned to ChatGPT</h1>' }));
  return writes;
}

for (const width of [390, 1280]) {
  test(`real consent route reviews identity then returns to host at ${width}px`, async ({ page, baseURL }) => {
    const writes = await fixture(page, baseURL);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/copilot/connect?request_id=${requestId}`);
    await expect(page.getByRole('heading', { name: 'Connect Repro to ChatGPT' })).toBeVisible();
    await expect(page.getByText(actor.email, { exact: true })).toBeVisible();
    await expect(page.getByText('Accounting access is unavailable for this account and will be excluded from the connection.')).toBeVisible();
    expect(writes.filter(write => write.path.includes('/copilot/'))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.REPRO_COPILOT_ARTIFACTS) await page.screenshot({ path: path.join(process.env.REPRO_COPILOT_ARTIFACTS, `consent-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Allow connection' }).click();
    await expect(page.getByRole('heading', { name: 'Returned to ChatGPT' })).toBeVisible();
    expect(writes.filter(write => write.path.includes('/copilot/'))).toEqual([{ path: `/api/copilot/oauth/requests/${requestId}`, method: 'POST', body: '{"approve":true}' }]);
  });
}

test('real connections route revokes only the selected fixture grant', async ({ page, baseURL }) => {
  const writes = await fixture(page, baseURL);
  await page.goto('/copilot/connections');
  await expect(page.getByRole('heading', { name: 'Connected apps' })).toBeVisible();
  await page.getByRole('button', { name: 'Revoke access' }).click();
  await expect(page.getByText('No active connections. Add Repro in ChatGPT to connect your account.')).toBeVisible();
  expect(writes.filter(write => write.path.includes('/copilot/'))).toEqual([{ path: `/api/copilot/oauth/connections/${requestId}`, method: 'DELETE', body: null }]);
});
