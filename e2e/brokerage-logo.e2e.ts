import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const client = {
  id: '42', name: 'Example Agent', email: 'agent@example.test', role: 'client',
  company: 'Example Realty', company_name: 'Example Realty', account_status: 'active',
  email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01', accountRepId: 99 },
};
const logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160" viewBox="0 0 600 160"><rect width="600" height="160" fill="white"/><path d="M35 90 L75 50 L115 90 M48 82 V120 H102 V82" fill="none" stroke="#1a56db" stroke-width="7"/><text x="140" y="93" fill="#14213d" font-family="Arial,sans-serif" font-size="39" font-weight="700">EXAMPLE REALTY</text><text x="141" y="122" fill="#64748b" font-family="Arial,sans-serif" font-size="15" letter-spacing="4">YOUR LOCAL PROPERTY TEAM</text></svg>';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

async function fixture(page: Page, baseURL: string | undefined, role = 'client', canManage = true, theme = 'light') {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only.');
  const actor = role === 'client' ? client : { ...client, id: '99', name: 'Review Staff', role };
  const state = { logo: null as string | null, fail: false, writes: 0, brandingPayload: null as Record<string, unknown> | null };
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.addInitScript(({ actor, theme }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('authToken', 'local-brokerage-review');
    localStorage.setItem('user', JSON.stringify(actor));
    localStorage.setItem('theme', theme);
  }, { actor, theme });
  await page.route('**/brokerage-fixture.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: logoSvg }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname.replace(/^\/api/, '');
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (p === '/users/42/brokerage-logo') {
      if (request.method() !== 'GET') {
        state.writes++;
        if (!canManage) return reply({ message: 'Forbidden' }, 403);
        if (state.fail) return reply({ message: 'Review upload failure' }, 500);
        state.logo = request.method() === 'DELETE' ? null : '/brokerage-fixture.svg';
      }
      return reply({ data: { logo: state.logo, can_manage: canManage } });
    }
    if (p === '/users/42/branding') {
      if (request.method() === 'PUT') {
        state.brandingPayload = request.postDataJSON();
        const branding = state.brandingPayload?.branding as Record<string, unknown>;
        if (branding && 'logo' in branding) state.logo = branding.logo as string | null;
      }
      return reply({ data: { branding: { logo: state.logo }, linked_clients: [] } });
    }
    if (request.method() !== 'GET') return route.fulfill({ status: p === '/system-telemetry/events' ? 204 : 405 });
    if (p === '/user') return reply(actor);
    if (p === '/listing-studio/client/account') return reply({ success: true, data: { credits: { availableCents: 0, reservedCents: 0 }, subscription: null } });
    if (p === '/profile/activity') return reply({ activities: [] });
    if (p === '/profile/security') return reply({ two_factor: { enabled: false, confirmed_at: null, recovery_codes_remaining: 0 }, password: { changed_at: null }, sessions: [] });
    if (p === '/me/permissions') {
      const resources = ['dashboard', 'dashboard-client', 'settings', 'profile', 'shoots', 'invoices', 'support', 'availability', 'robbie', 'portal'];
      if (role !== 'client') resources.push('dashboard-admin', 'dashboard-sales', 'accounts', 'clients');
      const permissions = resources.map(resource => ({ resource, action: 'view' }));
      if (role !== 'client') permissions.push({ resource: 'clients', action: 'update' });
      return reply({ permissions, permissionIds: permissions.map(item => `${item.resource}-${item.action}`) });
    }
    if (p === '/admin/users' || p === '/admin/users/search') return reply({ users: [client], meta: { total: 1, last_page: 1, current_page: 1 } });
    if (p === '/admin/users/42') return reply({ user: client });
    if (p === '/admin/clients') return reply({ clients: [client], data: [client] });
    if (p === '/notifications') return reply({ data: { activity_log: [], unread_count: 0 } });
    if (p === '/messaging/badge-counts') return reply({ email: 0, sms: 0, call: 0, total: 0 });
    if (p === '/voice/browser/config') return reply({ enabled: false, ready: false, blockers: [] });
    if (p === '/shoots/filters') return reply({ data: { clients: [], photographers: [], salesReps: [], services: [] } });
    if (p === '/shoots' || p === '/shoots/history') return reply({ shoots: [], data: [], meta: { total: 0, last_page: 1, current_page: 1 } });
    if (p === '/account-links/has-linked') return reply({ hasLinkedAccounts: false, linkedAccounts: [] });
    if (p === '/services' || p === '/service-categories') return reply([]);
    return reply({ data: [] });
  });
  return state;
}

async function screenshot(page: Page, name: string) {
  const directory = process.env.BROKERAGE_LOGO_REVIEW_OUTPUT;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`) });
}

test('client profile uploads, reloads and removes a persisted logo', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/profile');
  const block = page.getByRole('region', { name: 'Brokerage logo' });
  await expect(block.getByRole('button', { name: 'Upload logo' })).toBeVisible();
  await screenshot(page, 'desktop-client-profile-empty');
  await block.getByLabel('Upload brokerage logo').setInputFiles({ name: 'brokerage.png', mimeType: 'image/png', buffer: png });
  await expect(block.getByRole('status')).toHaveText('Brokerage logo saved.');
  await expect(block.getByRole('img', { name: 'Example Realty logo' })).toBeVisible();
  await screenshot(page, 'desktop-client-profile-saved');
  await page.reload();
  await expect(block.getByRole('img', { name: 'Example Realty logo' })).toHaveAttribute('src', '/brokerage-fixture.svg');
  await block.getByRole('button', { name: 'Remove' }).click();
  await expect(block.getByRole('status')).toHaveText('Brokerage logo removed.');
  expect(state.writes).toBe(2);
});

test('phone profile supports retry after failure and fits the viewport in dark mode', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, 'client', true, 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profile');
  const block = page.getByRole('region', { name: 'Brokerage logo' });
  await expect(block.getByRole('button', { name: 'Upload logo' })).toBeVisible();
  state.fail = true;
  await block.getByLabel('Upload brokerage logo').setInputFiles({ name: 'brokerage.png', mimeType: 'image/png', buffer: png });
  await expect(block.getByRole('alert')).toContainText('could not be saved');
  state.fail = false;
  await block.getByLabel('Upload brokerage logo').setInputFiles({ name: 'brokerage.png', mimeType: 'image/png', buffer: png });
  await expect(block.getByRole('status')).toHaveText('Brokerage logo saved.');
  await block.evaluate(element => element.scrollIntoView({ block: 'center' }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(block.getByRole('img', { name: 'Example Realty logo' })).toHaveCSS('object-fit', 'contain');
  await screenshot(page, 'phone-client-profile-dark');
});

test('account summary links to the logo editor under the profile photo', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, 'admin');
  state.logo = '/brokerage-fixture.svg';
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/accounts?account=42');
  const summary = page.getByRole('dialog', { name: 'User Profile', exact: true });
  await expect(summary.getByRole('button', { name: 'Change logo' })).toBeVisible();
  await screenshot(page, 'desktop-profile-summary');
  await summary.getByRole('button', { name: 'Change logo' }).click();
  const editor = page.getByRole('dialog', { name: 'Update account details', exact: true });
  await expect(editor.getByRole('region', { name: 'Brokerage logo' }).getByRole('button', { name: 'Replace logo' })).toBeVisible();
  const company = await editor.getByRole('textbox', { name: 'Company', exact: true }).boundingBox();
  const firstName = await editor.getByRole('textbox', { name: 'First Name', exact: true }).boundingBox();
  const logo = await editor.getByRole('region', { name: 'Brokerage logo' }).boundingBox();
  const officeVisibility = await editor.getByRole('switch', { name: 'Show office phone on branded tour' }).locator('..').locator('..').boundingBox();
  expect(company && firstName && logo && officeVisibility).toBeTruthy();
  // Lower fields reclaim the full width once both the identity controls and
  // top contact fields end, without leaving a tall gap beside either column.
  const identityBottom = logo!.y + logo!.height;
  const contactBottom = officeVisibility!.y + officeVisibility!.height;
  expect(company!.x).toBeCloseTo(logo!.x, 0);
  expect(company!.width).toBeGreaterThan(firstName!.width);
  expect(company!.y - Math.max(identityBottom, contactBottom)).toBeGreaterThan(0);
  expect(company!.y - Math.max(identityBottom, contactBottom)).toBeLessThan(60);
  expect(Math.abs(identityBottom - contactBottom)).toBeLessThan(64);
  const city = await editor.getByRole('textbox', { name: 'City', exact: true }).boundingBox();
  const zip = await editor.getByRole('textbox', { name: 'Zip Code', exact: true }).boundingBox();
  const lastName = await editor.getByRole('textbox', { name: 'Last Name', exact: true }).boundingBox();
  const stateField = await editor.getByRole('combobox').filter({ hasText: 'Select state' }).boundingBox();
  const license = await editor.getByRole('textbox', { name: 'License number', exact: true }).boundingBox();
  expect(city!.y).toBeCloseTo(zip!.y, 0);
  expect(city!.x).toBeCloseTo(company!.x, 0);
  expect(zip!.x + zip!.width).toBeCloseTo(lastName!.x + lastName!.width, 0);
  expect(stateField!.x).toBeCloseTo(license!.x, 0);
  await screenshot(page, 'desktop-account-editor');
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileEditor = page.getByRole('dialog', { name: 'Update account', exact: true });
  await expect(mobileEditor.getByRole('region', { name: 'Brokerage logo' }).getByRole('button', { name: 'Replace logo' })).toBeVisible();
  const mobileDialog = await mobileEditor.boundingBox();
  for (const name of ['First Name', 'Last Name', 'Company', 'License number']) {
    const field = await mobileEditor.getByRole('textbox', { name, exact: true }).boundingBox();
    expect(field!.x).toBeGreaterThanOrEqual(mobileDialog!.x);
    expect(field!.x + field!.width).toBeLessThanOrEqual(mobileDialog!.x + mobileDialog!.width);
  }
  await screenshot(page, 'phone-account-editor');
});

test('unassigned rep sees the logo without a management shortcut or upload controls', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, 'salesRep', false);
  state.logo = '/brokerage-fixture.svg';
  await page.goto('/accounts?account=42');
  const summary = page.getByRole('dialog', { name: 'User Profile', exact: true });
  await expect(summary.getByRole('img', { name: 'Example Realty logo' })).toBeVisible();
  await expect(summary.getByRole('button', { name: 'Change logo' })).toHaveCount(0);
  await summary.getByRole('button', { name: 'Edit Profile' }).click();
  const block = page.getByRole('region', { name: 'Brokerage logo' });
  await expect(block.getByRole('img', { name: 'Example Realty logo' })).toBeVisible();
  await expect(block.getByLabel('Upload brokerage logo')).toHaveCount(0);
  await expect(block.getByRole('button')).toHaveCount(0);
  expect(state.writes).toBe(0);
});

test('Settings profile and Branding share the saved logo without a stale form wiping it', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL);
  await page.goto('/settings?tab=profile');
  const block = page.getByRole('region', { name: 'Brokerage logo' });
  await expect(block.getByRole('button', { name: 'Upload logo' })).toBeVisible();
  await block.getByLabel('Upload brokerage logo').setInputFiles({ name: 'brokerage.png', mimeType: 'image/png', buffer: png });
  await expect(block.getByRole('status')).toHaveText('Brokerage logo saved.');
  await page.getByRole('tab', { name: 'Branding', exact: true }).click();
  await expect(block.getByRole('img', { name: 'Brokerage logo', exact: true })).toHaveAttribute('src', '/brokerage-fixture.svg');
  await page.getByRole('button', { name: 'Save Branding', exact: true }).click();
  await expect.poll(() => state.brandingPayload).not.toBeNull();
  expect(state.brandingPayload?.branding).not.toHaveProperty('logo');
  await page.reload();
  await expect(block.getByRole('img', { name: 'Brokerage logo', exact: true })).toHaveAttribute('src', '/brokerage-fixture.svg');
});
