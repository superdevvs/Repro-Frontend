import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const output = process.env.HOME_SCREEN_REVIEW_OUTPUT || path.resolve('C:/Users/shubh/Desktop/Projects/ui exploration/time picker/home-screen-call-alerts');
const user = { id: '900501', name: 'Review Admin', email: 'review@example.test', role: 'admin', account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } };
const permissions = ['view', 'operate', 'manage', 'supervise'].map(action => ({ resource: 'voice-calls', action }))
  .concat(['dashboard', 'shoots', 'accounts', 'settings', 'support'].map(resource => ({ resource, action: 'view' })));

async function fixture(page: Page, installed = false) {
  const mutations: string[] = [];
  await page.addInitScript(({ user, installed }) => {
    localStorage.setItem('authToken', 'local-home-screen-review');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('theme', 'light');
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: installed });
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'default' });
  }, { user, installed });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^\/api/, '');
    if (p.startsWith('/voice/') && route.request().method() !== 'GET') mutations.push(p);
    let body: unknown = { data: [], success: true };
    if (p === '/user') body = user;
    if (p === '/me/permissions') body = { permissions, permissionIds: permissions.map(({ resource, action }) => `${resource}:${action}`) };
    if (p === '/voice/browser/config') body = { enabled: false, ready: false, blockers: ['Local review only.'], capabilities: {} };
    if (p === '/voice/push/settings') body = { configured: true, blockers: [], public_key: 'local-review-key', preferences: { incoming_calls: true }, devices: [] };
    if (p === '/voice/phone/settings') body = { available: true, phone_enabled: false, phone_number: null, phone_verified_at: null, pending_phone: null };
    if (p === '/voice/numbers') body = { numbers: [] };
    if (p === '/voice/settings') body = { enabled: true, outbound_mode: 'none', provider: 'telnyx', tool_allowlist: [], automation_toggles: {}, business_hours: { timezone: 'America/New_York', weekly: {} }, holidays: [] };
    if (p === '/voice/llm-usage') body = { spend_usd: 0, budget_usd: 50, by_model: [] };
    if (p === '/voice/schedule/state') body = { state: { label: 'Team hours' } };
    if (p === '/voice/incoming-offers') body = { data: [{ id: '00000000-0000-4000-8000-000000000001', voice_call_id: 1, status: 'waiting', expires_at: '2099-01-01T00:00:00Z', caller_name: 'Local Caller', remote_phone: '+12025550111', can_claim: true, phone_available: false }] };
    if (p === '/voice/calls') body = { data: [], total: 0, current_page: 1, last_page: 1 };
    if (p === '/notifications') body = { data: { activity_log: [], unread_count: 0 } };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  return mutations;
}

test.describe('iPhone Home Screen call setup (browser emulation)', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });

  test('guides installation before enabling push, with no automatic permission request', async ({ page, baseURL }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
    const mutations = await fixture(page);
    await page.goto('/calls/settings');
    const button = page.getByRole('button', { name: 'Add to Home Screen' });
    await expect(button).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable this device' })).toBeDisabled();
    await button.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Safari');
    await expect(dialog).toContainText('Enable this device');
    await expect(dialog).toContainText('Open as Web App');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(output, 'iphone-install-instructions.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Got it' }).click();
    expect(mutations).toEqual([]);
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await page.request.get(manifestLink!);
    expect(response.headers()['content-type']).toContain('json');
    const manifest = await response.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true);
  });

  test('shows the next alert setup step in the installed app', async ({ page }) => {
    const mutations = await fixture(page, true);
    await page.goto('/calls/settings');
    await expect(page.getByText('REPro is open as an app.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to Home Screen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enable this device' })).toBeEnabled();
    expect(mutations).toEqual([]);
    await page.screenshot({ path: path.join(output, 'iphone-installed-enable-alerts.png'), animations: 'disabled' });
  });

  test('opens a notification offer in the team queue without claiming it automatically', async ({ page }) => {
    const mutations = await fixture(page, true);
    await page.goto('/calls?offer=00000000-0000-4000-8000-000000000001');
    await expect(page).toHaveURL(/\/calls\/live\?offer=/);
    await expect(page.getByRole('region', { name: 'Incoming call from Local Caller' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Answer in browser' })).toBeEnabled();
    expect(mutations).toEqual([]);
  });
});

test('shows and dismisses the mobile dashboard install suggestion', async ({ page, baseURL }) => {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Android Chrome' }); });
  await fixture(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('complementary', { name: 'Add dashboard to Home Screen' })).toBeVisible();
  expect((await page.getByRole('complementary').boundingBox())!.height).toBeLessThan(130);
  await page.screenshot({ path: path.join(output, 'mobile-dashboard-install-banner.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Dismiss Home Screen suggestion' }).click();
  await expect(page.getByRole('complementary', { name: 'Add dashboard to Home Screen' })).toHaveCount(0);
  await page.goto('/calls/settings');
  await expect(page.getByRole('button', { name: 'Add to Home Screen' })).toBeVisible();
});
