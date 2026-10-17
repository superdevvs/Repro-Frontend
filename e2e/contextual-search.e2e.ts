import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';

const output = process.env.SEARCH_E2E_OUTPUT_DIR ?? (process.platform === 'win32'
  ? path.join(os.homedir(), 'Desktop/Projects/ui exploration/time picker/contextual-search-20261017')
  : path.join(os.tmpdir(), 'contextual-search-e2e'));
const timestamp = '2026-10-01T09:00:00Z';
const scopes = ['accounts', 'shoots', 'invoices', 'email', 'sms', 'support', 'calls', 'people', 'services', 'templates', 'automations', 'studio', 'listings', 'cubicasa', 'availability', 'permissions', 'settings', 'reports', 'profile', 'integrations'].map(id => ({ id, label: id }));
const account = { id: 42, name: 'Acme Agent', email: 'agent@example.test', role: 'client', phone: '+1 (202) 555-0137', company: 'Acme Realty', company_name: 'Acme Realty', active: true, account_status: 'active', metadata: {}, email_health: { is_verified: true } };

async function fixture(page: Page, baseURL: string | undefined, role = 'admin') {
  if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') throw new Error('Loopback fixtures only.');
  const user = { id: 900517, name: 'Search Review', email: 'search-review@example.test', role, account_status: 'active', email_verified_at: timestamp, metadata: { terms_accepted_at: timestamp } };
  const requests: { path: string; method: string; query: string }[] = [];
  await page.addInitScript(user => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('authToken', 'local-search-fixture'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'light'); }, user);
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname.replace(/^\/api/, '');
    requests.push({ path: p, method: request.method(), query: url.search });
    const reply = (json: unknown) => route.fulfill({ status: 200, json });
    if (request.method() !== 'GET') return route.fulfill({ status: p === '/system-telemetry/events' ? 204 : 405 });
    if (p === '/user') return reply(user);
    if (p === '/me/permissions') {
      const resources = ['dashboard', 'dashboard-admin', 'dashboard-sales', 'dashboard-client', 'dashboard-photographer', 'dashboard-editor', 'shoots', 'invoices', 'settings', 'profile', 'support', 'accounts', 'account-linking', 'availability', 'accounting', 'messaging-email', 'messaging-overview', 'messaging-templates', 'messaging-automations', 'messaging-settings', 'messaging-sms', 'voice-calls', 'scheduling-settings', 'permissions-manager', 'ai-editing', 'portal', 'cubicasa-scanning', 'robbie'];
      const permissions = resources.map(resource => ({ resource, action: 'view' })).concat([{ resource: 'voice-calls', action: 'operate' }]);
      return reply({ permissions, permissionIds: permissions.map(item => `${item.resource}-${item.action}`) });
    }
    if (p === '/search/scopes') return reply({ enabled: true, scopes });
    if (p === '/search') return reply({ groups: [] });
    if (p === '/search/accounts/42/preview') return reply({ data: { type: 'accounts', id: '42', title: 'Acme Agent', destination: '/accounts?account=42', metadata: { Company: 'Acme Realty', Phone: account.phone, Role: 'client' } } });
    if (p === '/admin/users') return reply({ users: [account] });
    if (p === '/admin/users/search') {
      const q = (url.searchParams.get('search') || '').toLowerCase();
      const rows = `${account.name} ${account.email} ${account.company} 12025550137`.toLowerCase().includes(q) ? [account] : [];
      return reply({ users: rows, meta: { total: rows.length, last_page: 1, current_page: 1 } });
    }
    if (p === '/admin/users/42') return reply({ user: account });
    if (p === '/admin/clients') return reply({ clients: [account], data: [account] });
    if (p === '/admin/permissions') return reply({ roles: [{ id: 'admin', label: 'Administrator' }], catalog: [], permissions: { admin: [] }, defaults: { admin: [] } });
    const linkedClient = { ...account, id: '42' };
    if (p === '/account-links/has-linked' || p === '/account-links/my-linked-accounts') return reply({ hasLinkedAccounts: true, linkedAccounts: [linkedClient], total: 1 });
    if (p === '/account-links/my-shared-data') return reply({ client: linkedClient, link: { sharedDetails: { shoots: true, invoices: false }, linkedAt: timestamp }, sharedData: { totalShoots: 2, totalSpent: 100, sharedShoots: [{ id: '86', address: 'Acme Property', status: 'delivered' }, { id: '87', address: 'Other Property', status: 'delivered' }], properties: [], invoiceHistory: [{ id: 'private', invoiceNumber: 'Hidden invoice', amount: 100, balanceDue: 0, status: 'paid' }] } });
    if (p === '/admin/account-links') return reply({ data: [], owners: [], summary: { owners: 0, active: 0, attention: 0 } });
    if (p === '/admin/accounting-home') return reply({ data: { start: '2026-09-01', end: '2026-10-01', received: 0, prior_received: 0, paid: 0, open: 0, collected: 0, accounts: 0, open_count: 0, aging: {}, recipients: { photographer: { paid: 0, unpaid: 0, review: 0 }, rep: { paid: 0, unpaid: 0, review: 0 }, editor: { paid: 0, unpaid: 0, review: 0 } }, daily: [], ledger: [], attention: [], methods: {}, services: [], expenses: [], subscriptions: [], equipment: { pending: 0, linked: 0 } } });
    if (p === '/admin/editors/earnings') return reply({ data: [], summary: { editor_count: 0, total_earned: 0, unpaid_amount: 0, service_count: 0 }, period: { start: '2026-09-01', end: '2026-10-01' } });
    if (p === '/messaging/templates' || p === '/messaging/automations') return reply([]);
    if (p === '/studio/workspaces/capabilities') return reply({ success: true, data: { presets: {}, revision: { ready: false, referenceImages: false }, upscale: { ready: false }, outpaint: { ready: false } } });
    if (p === '/voice/browser/config') return reply({ enabled: false, ready: false, blockers: [] });
    if (p === '/notifications') return reply({ data: { activity_log: [], unread_count: 0 } });
    if (p === '/messaging/badge-counts') return reply({ email: 0, sms: 0, call: 0, total: 0 });
    if (p === '/shoots/filters') return reply({ data: { clients: [], photographers: [], salesReps: [], services: [] } });
    if (p === '/shoots/86') return reply({ data: { id: 86, address: 'Acme Property', city: 'Test City', state: 'VA', zip: '22201', client_id: account.id, client: account, status: 'delivered', workflow_status: 'delivered', scheduled_date: '2026-10-01', services: [], payment_status: 'paid', total_quote: 100, total_paid: 100, editor_id: role === 'editor' ? user.id : null } });
    if (p === '/shoots/86/files') return reply({ data: [{ id: 'file-1', filename: 'Kitchen Final.jpg', file_type: 'image', media_type: 'photo', workflow_stage: 'raw', url: '/fixture-kitchen.jpg' }, { id: 'file-2', filename: 'Exterior.jpg', file_type: 'image', media_type: 'photo', workflow_stage: 'raw', url: '/fixture-exterior.jpg' }] });
    if (p === '/shoots/86/notes') return reply({ data: [{ type: 'shoot', content: 'Acme visible note' }, { type: 'company', content: 'Hidden company secret' }] });
    if (p === '/shoots' || p === '/shoots/history') return reply({ data: [], meta: { count: 0, total: 0, current_page: 1, per_page: 12, filters: { clients: [], photographers: [], salesReps: [], services: [] } } });
    if (p === '/support/tickets') return reply({ data: [], meta: { can_manage: role === 'admin', categories: [], statuses: [], pagination: { current_page: 1, last_page: 1, total: 0, per_page: 20 } } });
    return reply({ data: [], users: [], success: true, meta: { current_page: 1, last_page: 1, total: 0, per_page: 20 }, total: 0, current_page: 1, last_page: 1 });
  });
  return requests;
}

const contexts = [
  ['/accounts', 'Accounts'], ['/shoot-history?tab=scheduled', 'Shoots · scheduled'],
  ['/accounting', 'Invoices'], ['/portal', 'Exclusive listings · Map'],
  ['/messaging/email/inbox', 'Email inbox'], ['/messaging/sms', 'SMS inbox'],
  ['/messaging/email/inbox?tab=support', 'Support requests'],
  ['/calls/inbox', 'Calls inbox'], ['/calls/people', 'People'], ['/ai-editing', 'Studio'],
  ['/scheduling-settings', 'Services'], ['/availability', 'Availability team'], ['/cubicasa-scanning', 'Property scans'],
  ['/messaging/email/templates', 'Templates'], ['/messaging/email/automations', 'Automations'],
  ['/permissions', 'Permissions'],
  ['/accounts?tab=inactive', 'Inactive clients'], ['/accounts?tab=linking', 'Account owners'],
  ['/accounting?tab=photographers', 'Photographer invoices'], ['/accounting?tab=sales-reps', 'Sales Rep invoices'],
  ['/accounting?tab=editors', 'Editor earnings'], ['/accounting?tab=home&workspace=expenses', 'Accounting'],
  ['/shared?client=42', 'Shared · Acme Agent'], ['/shoots/86/acme-property', 'Shoot #86 · Raw media'],
  ['/chat-with-reproai?tab=history', 'My AI chat history'],
] as const;

for (const width of [1440, 390]) for (const [route, label] of contexts) {
  test(`${label} uses the header search at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    const requests = await fixture(page, baseURL);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const entry = page.getByLabel(`Search ${label}`, { exact: true });
    await expect(entry).toBeVisible({ timeout: 45_000 });
    const baselineWrites = requests.filter(item => item.method !== 'GET' && item.path !== '/system-telemetry/events').length;
    await entry.click();
    const dialog = page.getByRole('dialog', { name: `Search ${label}`, exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox').fill('Acme');
    await expect(page).toHaveURL(/search=Acme/);
    await expect(page).toHaveURL(/searchContext=/);
    await dialog.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(page).not.toHaveURL(/[?&]search=Acme/);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-page-search-container] input')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(requests.filter(item => item.method !== 'GET' && item.path !== '/system-telemetry/events')).toHaveLength(baselineWrites);
    expect(errors).toEqual([]);
    if (route === '/accounts' || route.startsWith('/shoot-history')) await page.screenshot({ path: path.join(output, `${label.replace(/[^a-z]/gi, '-')}-${width}.png`) });
  });
}

for (const role of ['admin', 'superadmin', 'editing_manager', 'salesRep', 'client', 'photographer', 'editor']) test(`${role} can use header search`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, baseURL, role);
  await page.goto('/messaging/email/inbox?tab=support');
  await page.getByLabel('Search Support requests', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search Support requests' })).toBeVisible();
});

test('Accounts previews and filtered lists share the query without opening a record', async ({ page, baseURL }) => {
  await fixture(page, baseURL);
  await page.goto('/accounts');
  await page.getByLabel('Search Accounts', { exact: true }).click();
  await page.getByRole('combobox').fill('Acme');
  await page.getByRole('button', { name: 'Preview Acme Agent' }).click();
  await expect(page.getByRole('region', { name: 'Preview Acme Agent' })).toContainText('Acme Realty');
  await expect(page).not.toHaveURL(/account=42/);
  await page.getByRole('button', { name: 'Everywhere', exact: true }).click();
  await page.getByRole('combobox').fill('different query');
  await expect(page).toHaveURL(/search=Acme/);
  await page.getByRole('button', { name: 'Search Accounts', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveValue('Acme');
});

for (const width of [1440, 390]) test(`Account previews fit and return focus at ${width}px`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await fixture(page, baseURL);
  await page.goto('/accounts');
  await page.getByLabel('Search Accounts', { exact: true }).click();
  await page.getByRole('combobox').fill('Acme');
  await page.getByRole('button', { name: 'Preview Acme Agent' }).click();
  await expect(page.getByRole('region', { name: 'Preview Acme Agent' })).toContainText('Acme Realty');
  await page.screenshot({ path: path.join(output, `account-preview-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByText('Show matches in Accounts', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search Accounts' })).not.toBeVisible();
  await expect(page.locator('main')).toBeFocused();
});

test('Shared search cannot match invoice data when invoice sharing is disabled', async ({ page, baseURL }) => {
  const requests = await fixture(page, baseURL);
  await page.goto('/shared?client=42');
  await page.getByLabel('Search Shared · Acme Agent', { exact: true }).click();
  await page.getByRole('combobox').fill('Hidden invoice');
  await expect(page.getByRole('dialog')).toContainText('No matches');
  expect(requests.some(item => item.path === '/search' && item.query.includes('scope=shoots'))).toBe(false);
});

test('Media search filters filenames and clearing restores the grid', async ({ page, baseURL }) => {
  const requests = await fixture(page, baseURL);
  await page.goto('/shoots/86/acme-property');
  await expect(page.getByText('Exterior.jpg', { exact: true }).first()).toBeVisible();
  const writes = requests.filter(item => item.method !== 'GET' && item.path !== '/system-telemetry/events').length;
  await page.getByRole('searchbox', { name: 'Search Shoot #86 · Raw media', exact: true }).click();
  await page.getByRole('combobox').fill('Kitchen');
  await expect(page.getByRole('button', { name: 'Preview Kitchen Final.jpg' })).toBeVisible();
  await page.getByText('Show matches in Shoot #86 · Raw media', { exact: true }).click();
  await expect(page.getByText('Exterior.jpg', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Kitchen Final.jpg', { exact: true }).first()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search Shoot #86 · Raw media', exact: true }).click();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Exterior.jpg', { exact: true }).first()).toBeVisible();
  expect(requests.filter(item => item.method !== 'GET' && item.path !== '/system-telemetry/events')).toHaveLength(writes);
});

test('Shoot notes search uses only visible note categories and preview never saves', async ({ page, baseURL }) => {
  const requests = await fixture(page, baseURL, 'editor');
  await page.goto('/shoots/86/acme-property');
  await page.getByRole('tab', { name: 'Notes', exact: true }).click();
  await page.getByLabel('Search Shoot #86 · Notes', { exact: true }).click();
  const writes = requests.filter(item => item.method !== 'GET' && item.path !== '/system-telemetry/events').length;
  await page.getByRole('combobox').fill('Hidden company secret');
  await expect(page.getByRole('dialog')).toContainText('No matches');
  await page.getByRole('combobox').fill('Acme');
  await page.getByRole('button', { name: 'Preview Shoot Notes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Preview Shoot Notes' })).toContainText('Acme visible note');
  expect(requests.filter(item => item.method !== 'GET' && item.path !== '/system-telemetry/events')).toHaveLength(writes);
});

test('Everywhere opens complete results and preserves the selected result type', async ({ page, baseURL }) => {
  await fixture(page, baseURL);
  await page.route('**/api/search?**', route => route.fulfill({ status: 200, json: { groups: [{ scope: 'accounts', label: 'Accounts', hasMore: true, results: [{ type: 'accounts', id: '42', title: 'Acme Agent', destination: '/accounts?account=42' }] }] } }));
  await page.goto('/accounts');
  await page.getByRole('searchbox', { name: /Search accounts/i }).click();
  await page.getByRole('button', { name: 'Everywhere', exact: true }).click();
  await page.getByRole('combobox').fill('Acme');
  await expect(page.getByRole('button', { name: 'Preview Acme Agent' })).toBeVisible();
  await page.getByText('Show all matches', { exact: true }).click();
  await expect(page).toHaveURL(/\/search\?search=Acme/);
  await expect(page.getByRole('heading', { name: 'Search results' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Acme Agent', exact: true })).toBeVisible();
  await page.getByLabel('Result type', { exact: true }).selectOption('accounts');
  await expect(page).toHaveURL(/scope=accounts/);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole('searchbox', { name: /Search accounts/i }).click();
  await page.getByRole('combobox').fill('Different');
  await expect(page).toHaveURL(/search=Different/);
  await expect(page).not.toHaveURL(/page=2/);
});
