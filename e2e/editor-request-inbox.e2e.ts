import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) test(`editor can review the complete request inbox at ${width}px`, async ({ page, baseURL }) => {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
  await page.setViewportSize({ width, height: 900 });
  const user = { id: 901, name: 'Editor Review', email: 'editor@example.test', role: 'editor', account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } };
  await page.addInitScript(user => { localStorage.clear(); localStorage.setItem('authToken', 'local-editor-fixture'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'dark'); }, user);
  const requests = Array.from({ length: 5 }, (_, i) => ({ id: `request-${i}`, note: `Green grass request ${i + 1}`, status: 'open', shootId: 100 + i, shoot: { id: 100 + i, address: `${i + 1} Test Lane`, client: { id: 10 + i, name: `Client ${i + 1}` } }, canOpenShoot: i < 2, canUpdate: i < 2, createdAt: new Date().toISOString() }));
  const writes: string[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (route.request().method() !== 'GET') writes.push(path);
    const reply = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/user') return reply(user);
    if (path === '/me/permissions') { const permissions = ['dashboard', 'dashboard-editor', 'shoots', 'shoot-history', 'settings'].map(resource => ({ resource, action: 'view' })); return reply({ permissions, permissionIds: permissions.map(p => `${p.resource}:${p.action}`) }); }
    if (path === '/client-requests') return reply({ data: requests });
    return reply({ data: [], shoots: [], success: true, meta: { total: 0 } });
  });
  await page.goto('/dashboard');
  if (width < 1024) await page.getByRole('tab', { name: 'Requests', exact: true }).click();
  const card = page.locator('#requests-queue');
  await expect(card.getByRole('button', { name: 'Client (5)', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Client (5)', exact: true }).click();
  await card.getByRole('button', { name: 'View all client', exact: true }).click();
  const queue = page.getByRole('region', { name: 'Request queue' });
  await expect(queue.getByText('Green grass request 5', { exact: true })).toBeVisible();
  await queue.getByText('Green grass request 5', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Request details' })).toContainText('Green grass request 5');
  await expect(page.getByText(/View only/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open shoot', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `test-results/editor-inbox-${width}.png`, fullPage: true });
  expect(writes.filter(path => /\/issues/.test(path))).toEqual([]);
});
