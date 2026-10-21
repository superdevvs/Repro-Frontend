import { expect, test } from '@playwright/test';
import path from 'node:path';

test.use({ video: 'off' });

test('editing manager can see text-only Groundwire readiness at mobile width', async ({ page, baseURL }) => {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
  await page.setViewportSize({ width: 390, height: 844 });
  const user = { id: '377', name: 'Editing Manager', email: 'review@example.test', role: 'editing_manager', account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } };
  const permissions = ['view', 'operate'].map(action => ({ resource: 'voice-calls', action }));
  const mutations: string[] = [];
  await page.addInitScript(user => {
    localStorage.setItem('authToken', 'local-groundwire-review');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('theme', 'dark');
  }, user);
  await page.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (p.startsWith('/voice/') && route.request().method() !== 'GET') mutations.push(p);
    let body: unknown = { data: [], success: true };
    if (p === '/user') body = user;
    if (p === '/me/permissions') body = { permissions, permissionIds: permissions.map(({ resource, action }) => `${resource}:${action}`) };
    if (p === '/voice/browser/config') body = { enabled: false, ready: false, blockers: ['Text-only review.'], capabilities: {} };
    if (p === '/voice/push/settings') body = { configured: true, blockers: [], public_key: 'fixture', preferences: { incoming_calls: false }, devices: [] };
    if (p === '/voice/phone/settings') body = { available: true, phone_enabled: false, phone_number: null, phone_verified_at: null, pending_phone: null };
    if (p === '/voice/numbers') body = { numbers: [{ id: 4, phone_number: '+12027803332', label: 'Editing', can_call_from: false, line_policy: { mode: 'sms_only', recipient_ids: [377], recipient_roles: [], timezone: 'Asia/Kolkata', weekly_hours: {} } }] };
    if (p === '/voice/sip/devices') body = { configured: true, lines: [], devices: [{ id: 'editing-device', label: 'My Groundwire phone', state: 'ready', enabled: true, registered: true, caller_id: '+12027803332', sms: { number: '+12027803332', available_numbers: ['+12027803332'], ready: true, phone_connected: true, push_registered: true, last_fetch_at: null, last_send_at: null, setup_url: 'https://example.test/setup' } }] };
    if (p === '/notifications') body = { data: { activity_log: [], unread_count: 0 } };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/calls/settings', { waitUntil: 'domcontentloaded' });
  const settings = page.getByRole('region', { name: 'Groundwire mobile phone' });
  await expect(settings).toContainText('Text only · Groundwire SMS is available. Calls are off for your assigned line.');
  await expect(settings.getByLabel('Outgoing caller ID')).toHaveCount(0);
  await expect(settings).toContainText('+12027803332');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(mutations).toEqual([]);
  await settings.scrollIntoViewIfNeeded();
  if (process.env.GROUNDWIRE_REVIEW_OUTPUT) await page.screenshot({ path: path.join(process.env.GROUNDWIRE_REVIEW_OUTPUT, 'editing-text-only-mobile.png'), animations: 'disabled' });
});
