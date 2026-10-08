import { expect, test } from '@playwright/test';

for (const role of ['admin', 'salesRep']) for (const width of [1440, 390]) {
  test(`${role} can search and clear rep filters at ${width}px`, async ({ page, baseURL }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
    await page.setViewportSize({ width, height: 900 });
    const user = { id: 901, name: 'Filter Review', email: 'filters@example.test', role, account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } };
    await page.addInitScript(user => { localStorage.clear(); localStorage.setItem('authToken', 'local-filter-fixture'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'dark'); }, user);
    const queries: URL[] = [];
    const filters = { clients: [{ id: 20, name: 'Client One' }], photographers: [{ id: 30, name: 'Photographer One' }], salesReps: [{ id: 17, name: 'Alex Sales' }, { id: 18, name: 'Jordan Sales' }], services: ['HDR', 'HDR', 'Premium Video', 'Premium Video', ...Array.from({ length: 40 }, (_, i) => `Photo service ${i + 1}`)] };
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); const path = url.pathname.replace(/^\/api/, '');
      const reply = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/user') return reply(user);
      if (path === '/me/permissions') { const permissions = ['dashboard', 'dashboard-sales', 'shoots', 'shoot-history', 'book-shoot', 'accounts', 'settings'].map(resource => ({ resource, action: 'view' })); return reply({ permissions, permissionIds: permissions.map(p => `${p.resource}:${p.action}`) }); }
      if (path === '/shoots/filters') return reply({ data: filters });
      if (path === '/shoots' || path === '/shoots/history') { queries.push(url); return reply({ data: [], meta: { current_page: 1, per_page: 12, total: 0, count: 0, filters } }); }
      return reply({ data: [], success: true });
    });
    for (const tab of ['scheduled', 'completed', 'delivered']) {
      await page.goto(`/shoot-history?tab=${tab}`);
      if (width < 640) {
        await page.getByRole('button', { name: 'View options', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Show filters', exact: true }).click();
      } else await page.getByTitle('Show filters', { exact: true }).click();
      await expect.poll(() => queries.some(url => url.searchParams.get('tab') === tab)).toBe(true);
      const rep = page.getByRole('combobox', { name: 'Sales rep', exact: true });
      await rep.click();
      await page.getByRole('combobox', { name: 'Search sales rep', exact: true }).fill('Jordan');
      await expect(page.getByRole('option', { name: /Alex Sales/ })).toHaveCount(0);
      await page.getByRole('option', { name: /Jordan Sales/ }).click();
      await expect.poll(() => queries.some(url => url.searchParams.get('tab') === tab && url.searchParams.get('sales_rep_id') === '18')).toBe(true);
      await expect(rep).toContainText('Jordan Sales');
      await page.getByRole('button', { name: 'Services', exact: true }).click();
      const list = page.locator('[data-service-filter-list]');
      const metrics = await list.evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
      expect(metrics.height).toBeLessThanOrEqual(224);
      expect(metrics.scroll).toBeGreaterThan(metrics.height);
      await page.getByRole('textbox', { name: 'Search services', exact: true }).fill('Premium');
      await expect(list.locator('label')).toHaveCount(1);
      await list.getByRole('checkbox').check();
      await expect.poll(() => queries.some(url => url.searchParams.get('sales_rep_id') === '18' && [...url.searchParams.values()].includes('Premium Video'))).toBe(true);
      await page.screenshot({ path: `test-results/services-dropdown-${role}-${width}-${tab}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      if (width >= 1024) {
        const fields = page.locator('main').locator('input[placeholder="Search by address, client, photographer"], input[placeholder="Filter by address"], button[role="combobox"][aria-label="Client"], button[role="combobox"][aria-label="Photographer"], button[role="combobox"][aria-label="Sales rep"]');
        const tops = await fields.evaluateAll(elements => elements.map(el => Math.round(el.getBoundingClientRect().top)));
        expect(new Set(tops).size).toBe(2);
      }
      await page.screenshot({ path: `test-results/rep-filters-${role}-${width}-${tab}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await expect(rep).toContainText('All sales reps');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
    }
  });
}
