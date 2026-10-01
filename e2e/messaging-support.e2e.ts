import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';

const output = process.env.SUPPORT_REVIEW_OUTPUT || path.resolve('..', 'output', 'calls-support-implementation', 'messaging-support');
const timestamp = '2026-10-01T09:00:00Z';
const tickets = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, reference: `SUP-${String(i + 1).padStart(6, '0')}`, subject: `Review request ${i + 1}`, category: 'delivery', status: 'open', priority: 'normal', version: 1, page_path: '/shoot-history', requester: { id: 90, name: 'Review Client', role: 'client' }, assignee: null, created_at: timestamp, updated_at: timestamp }));
async function fixture(page: Page, baseURL: string | undefined, role = 'admin', theme = 'light', supportAllowed = true) {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only.');
  const user = { id: 900503, name: 'Review User', email: 'review@example.test', role, account_status: 'active', email_verified_at: timestamp, metadata: { terms_accepted_at: timestamp } };
  const requests: { path: string; method: string }[] = [];
  const canEmail = role === 'admin' || role === 'client';
  await page.addInitScript(({ user, theme }) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('authToken', 'local-messaging-review'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', theme); }, { user, theme });
  const reply = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const p = url.pathname.replace(/^\/api/, '');
    requests.push({ path: p, method: request.method() });
    if (p === '/user') return reply(route, user);
    if (p === '/me/permissions') {
      const resources = ['dashboard','shoots','settings', ...(supportAllowed ? ['support'] : []), ...(canEmail ? ['messaging-email'] : []), ...(role === 'admin' ? ['accounts','availability','accounting','messaging-overview','messaging-templates','messaging-automations','messaging-settings','messaging-sms','voice-calls'] : [])];
      const permissions = resources.map(resource => ({ resource, action: 'view' })).concat(canEmail ? [{ resource: 'messaging-compose', action: 'create' }, { resource: 'book-shoot', action: 'create' }] : []);
      return reply(route, { permissions, permissionIds: permissions.map(({ resource, action }) => `${resource}:${action}`) });
    }
    if (p === '/support/tickets') {
      const current = Number(url.searchParams.get('page') || 1); const query = url.searchParams.get('query') || '';
      const rows = tickets.filter(ticket => ticket.subject.toLowerCase().includes(query.toLowerCase()));
      return reply(route, { data: rows.slice((current - 1) * 20, current * 20), meta: { can_manage: role === 'admin', categories: [], statuses: [], pagination: { current_page: current, last_page: Math.max(1, Math.ceil(rows.length / 20)), total: rows.length, per_page: 20 } } });
    }
    if (p === '/support/tickets/assignees') return reply(route, { data: [{ id: 1, name: 'Review Admin' }] });
    if (/^\/support\/tickets\/\d+$/.test(p)) return reply(route, { data: { ...tickets[Number(p.split('/').at(-1)) - 1], can_manage: role === 'admin' }, messages: Array.from({ length: 25 }, (_, i) => ({ id: i + 1, body: `Review reply ${i + 1}. Open the shoot and use Download Center to retrieve the delivered files.`, internal: false, kind: 'reply', author: { id: 1, name: 'Review Admin' }, created_at: timestamp })), meta: { current_page: 1, last_page: 1, total: 25 } });
    if (p === '/messaging/email/messages') return reply(route, { data: [{ id: 71, channel: 'EMAIL', direction: 'INBOUND', status: 'SENT', send_source: 'MANUAL', from_address: 'support@example.test', to_address: user.email, subject: 'Existing Contact conversation', body_text: 'Your existing message stays available.', created_at: timestamp, updated_at: timestamp }], meta: { current_page: 1, last_page: 1, total: 1 } });
    if (p === '/messaging/badge-counts') return reply(route, { email: 1, sms: 0, call: 0, total: 1 });
    if (p === '/voice/browser/config') return reply(route, { enabled: false, ready: false, blockers: [] });
    if (p === '/notifications') return reply(route, { data: { activity_log: [], unread_count: 0 } });
    return reply(route, { success: true, data: [], notifications: [], unread_count: 0 });
  });
  return requests;
}

for (const width of [1440,390]) for (const theme of ['light','dark']) {
  test(`Messaging Support ${width}px ${theme} retains shell, links, pages and existing Inbox`, async ({ page, baseURL }) => {
    test.setTimeout(120000); await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const requests = await fixture(page, baseURL, 'admin', theme); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/support?ticket=2#reply');
    await expect(page.getByRole('heading', { name: 'Support inbox' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/messaging/email/inbox');
    expect(new URL(page.url()).searchParams.get('tab')).toBe('support');
    expect(new URL(page.url()).searchParams.get('ticket')).toBe('2');
    expect(new URL(page.url()).hash).toBe('#reply');
    const navigation = page.getByRole('navigation', { name: 'Messaging navigation' });
    await expect(navigation.getByRole('link', { name: 'Support', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(navigation.getByRole('link', { name: 'Inbox', exact: true })).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible();
    if (width === 1440) await expect(page.getByTestId('application-sidebar')).toBeVisible();
    else await expect(page.locator('[data-mobile-bottom-nav]')).toBeVisible();
    await expect(page.locator('a[href="/support"]')).toHaveCount(0);
    const messages = page.getByLabel('Request messages');
    expect(await messages.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
    await page.screenshot({ path: path.join(output, `${width}-${theme}-conversation.png`) });
    await page.getByRole('button', { name: 'All requests', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('tab')).toBe('support');
    await page.goBack(); await expect(page.getByLabel('Request messages')).toBeVisible();
    await page.goForward();
    const pagination = page.getByRole('navigation', { name: 'Support request pages' });
    await pagination.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review request 21', exact: true })).toBeVisible();
    await expect(pagination).toContainText('2 / 3');
    await page.getByLabel('Search support requests').fill('Review request 45');
    await expect(page.getByRole('heading', { name: 'Review request 45', exact: true })).toBeVisible();
    await expect(pagination).toContainText('1 / 1');
    await navigation.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${width}-${theme}-requests.png`) });
    expect(requests.some(request => request.path === '/messaging/email/messages')).toBe(false);
    await navigation.getByRole('link', { name: 'Inbox', exact: true }).click();
    await expect(page.getByText('Existing Contact conversation', { exact: true })).toBeVisible();
    await navigation.getByRole('link', { name: 'Support', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Support inbox' })).toBeVisible();
    await page.goto('/support?new=1');
    await expect(page.getByRole('dialog', { name: 'New support request' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('new')).toBe('1');
    expect(new URL(page.url()).searchParams.get('tab')).toBe('support');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(requests.filter(request => request.method !== 'GET' && request.path !== '/system-telemetry/events')).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const width of [1440,820,390]) test(`Support-only photographer discovers Messaging without email at ${width}px`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const requests = await fixture(page, baseURL, 'photographer');
  await page.goto('/support');
  await expect(page.getByRole('heading', { name: 'Your support requests' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Messaging navigation' });
  await expect(navigation.getByRole('link')).toHaveCount(1);
  await expect(navigation.getByRole('link', { name: 'Support' })).toBeVisible();
  if (width === 1440) await expect(page.getByRole('button', { name: 'Messaging', exact: true })).toBeVisible();
  else if (width === 820) {
    await expect(page.locator('[data-mobile-bottom-nav]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('menuitem', { name: 'Messaging', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your support requests' })).toBeVisible();
  }
  else {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('link', { name: 'Messaging', exact: true })).toBeVisible();
    const links = page.getByRole('link', { name: 'Support', exact: true }); await expect(links).toHaveCount(2);
    await links.last().click();
  }
  await page.screenshot({ path: path.join(output, `photographer-${width}-support.png`) });
  expect(requests.filter(request => request.path.startsWith('/messaging/'))).toEqual([]);
  await page.goto('/messaging/email/inbox');
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(requests.some(request => request.path === '/messaging/email/messages')).toBe(false);
});

test('denied Support does not fetch tickets and client Contact stays distinct', async ({ page, baseURL }) => {
  const requests = await fixture(page, baseURL, 'client', 'light', false);
  await page.goto('/messaging/email/inbox');
  const navigation = page.getByRole('navigation', { name: 'Messaging navigation' });
  await expect(navigation.getByRole('link', { name: 'Contact', exact: true })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Support', exact: true })).toHaveCount(0);
  await expect(page.getByText('Existing Contact conversation', { exact: true })).toBeVisible();
  await page.goto('/support?ticket=2'); await expect(page).toHaveURL(/\/dashboard$/);
  expect(requests.some(request => request.path.startsWith('/support/tickets'))).toBe(false);
});
