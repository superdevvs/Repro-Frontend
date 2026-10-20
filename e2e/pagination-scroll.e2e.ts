import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

test.use({ browserName: process.env.E2E_PAGINATION_BROWSER === 'webkit' ? 'webkit' : 'chromium', hasTouch: true, video: 'off', trace: 'off', screenshot: 'off' });

async function installFixture(page: Page, baseURL: string | undefined) {
  await installDashboardMobileFixtures(page, baseURL, 'admin', true, ['accounts', 'shoot-history']);
  await page.route('**/*', route => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
  await page.routeWebSocket(url => !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), socket => socket.close());
  const accounts = Array.from({ length: 47 }, (_, index) => ({ id: index + 1000, name: `Pagination Photographer ${String(index + 1).padStart(2, '0')}`, email: `photographer${index + 1}@example.test`, role: 'photographer', account_status: 'active', email_verified_at: '2026-01-01', phone: '(555) 123-4567', created_at: '2026-01-01' }));
  await page.route('**/api/admin/users?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ users: accounts }) }));
  return accounts;
}

async function savePreview(page: Page, filename: string) {
  if (process.env.E2E_PAGINATION_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.E2E_PAGINATION_SCREENSHOT_DIR, filename) });
}

for (const viewport of [{ width: 390, height: 740 }, { width: 820, height: 1000 }, { width: 1440, height: 900 }]) {
  test(`Accounts pagination returns to the first record at ${viewport.width}px`, async ({ page, baseURL, browserName }) => {
    await page.setViewportSize(viewport);
    await installFixture(page, baseURL);
    await page.goto('/accounts?role=photographer', { waitUntil: 'domcontentloaded' });
    const list = page.locator('[data-pagination-list]');
    const first = (number: number) => list.getByText(`Pagination Photographer ${String(number).padStart(2, '0')}`, { exact: true }).first();
    await expect(first(1)).toBeVisible();
    const next = page.getByRole('button', { name: 'Next accounts page', exact: true });
    const previous = page.getByRole('button', { name: 'Previous accounts page', exact: true });
    await next.scrollIntoViewIfNeeded();
    expect(await page.locator('main').evaluate(element => element.scrollTop)).toBeGreaterThan(300);
    await next.click();
    await expect(first(17)).toBeInViewport();
    expect(await page.locator('main').evaluate(element => element.scrollTop)).toBeLessThan(300);
    await next.click();
    await expect(first(33)).toBeInViewport();
    await previous.click();
    await expect(first(17)).toBeInViewport();
    if (viewport.width >= 640) {
      await page.getByRole('button', { name: 'Go to accounts page 3', exact: true }).click();
      await expect(first(33)).toBeInViewport();
      await page.getByRole('button', { name: 'First accounts page', exact: true }).click();
      await expect(first(1)).toBeInViewport();
      await page.getByRole('button', { name: 'Last accounts page', exact: true }).click();
      await expect(first(33)).toBeInViewport();
    }
    await page.getByRole('combobox', { name: 'Accounts per page', exact: true }).click();
    await page.getByRole('option', { name: '12', exact: true }).click();
    await expect(first(1)).toBeInViewport();
    await savePreview(page, `accounts-${browserName}-${viewport.width}.png`);
  });

  test(`nested invoice pagination waits for rows and leaves other panels alone at ${viewport.width}px`, async ({ page, baseURL, browserName }) => {
    await page.setViewportSize(viewport);
    await installFixture(page, baseURL);
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Next accounts page', exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const reactPath = '/node_modules/.vite/deps/react.js', domPath = '/node_modules/.vite/deps/react-dom_client.js';
      const invoicePath = '/src/components/accounting/InvoiceList.tsx';
      const React = (await import(reactPath)).default, { createRoot } = (await import(domPath)).default, { InvoiceList } = await import(invoicePath);
      document.getElementById('root')!.style.display = 'none';
      const host = document.createElement('div'); document.body.append(host);
      const style = document.createElement('style');
      style.textContent = '[aria-label="Invoice results, scroll for more"] { height:430px; }'; document.head.append(style);
      const noop = () => undefined;
      function Preview() {
        const [page, setPage] = React.useState(1), [loading, setLoading] = React.useState(false), [loadedPage, setLoadedPage] = React.useState(1);
        React.useEffect(() => { setLoading(true); const timer = setTimeout(() => { setLoadedPage(page); setLoading(false); }, 250); return () => clearTimeout(timer); }, [page]);
        const invoices = Array.from({ length: 16 }, (_, index) => ({ id: String((loadedPage - 1) * 16 + index + 1), number: `INVOICE-${(loadedPage - 1) * 16 + index + 1}`, client: 'Pagination Client', property: `Invoice property ${(loadedPage - 1) * 16 + index + 1}`, date: '2026-10-19', dueDate: '2026-11-19', amount: 100, balance: 100, status: 'pending', services: ['Photos'], paymentMethod: 'N/A' }));
        const params = React.useMemo(() => ({ page, per_page: 16 }), [page]);
        return React.createElement('main', { 'data-testid': 'invoice-preview-page', style: { position: 'fixed', inset: 0, overflow: 'auto', padding: 16, background: 'hsl(var(--background))', zIndex: 10 } },
          React.createElement('div', { style: { height: 180 } }, 'Accounting review'),
          React.createElement('section', { 'aria-label': 'Invoice pagination preview' }, React.createElement(InvoiceList, { data: { invoices }, server: { page, perPage: 16, total: 48, params, onChange: next => setPage(next.page || 1) }, loading, role: 'admin', isAdmin: true, onView: noop, onEdit: noop, onDownload: noop, onPay: noop, onSendReminder: noop })),
          React.createElement('aside', { 'data-testid': 'untouched-panel', style: { height: 100, overflow: 'auto' } }, React.createElement('div', { style: { height: 800 } }, 'Another list')),
          React.createElement('div', { style: { height: 500 } }));
      }
      createRoot(host).render(React.createElement(Preview));
    });
    const panel = page.getByRole('region', { name: 'Invoice results, scroll for more', exact: true });
    await expect(panel.getByText('Invoice property 1', { exact: true })).toBeVisible();
    const next = page.getByRole('link', { name: 'Go to next page', exact: true });
    await next.scrollIntoViewIfNeeded();
    await panel.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await panel.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
    await page.getByTestId('untouched-panel').evaluate(element => { element.scrollTop = 150; });
    const outer = await page.getByTestId('invoice-preview-page').evaluate(element => element.scrollTop);
    await next.click();
    await expect(panel.getByText('Invoice property 17', { exact: true })).toBeVisible();
    await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBe(0);
    expect(await page.getByTestId('untouched-panel').evaluate(element => element.scrollTop)).toBe(150);
    expect(await page.getByTestId('invoice-preview-page').evaluate(element => element.scrollTop)).toBe(outer);
    await savePreview(page, `invoices-${browserName}-${viewport.width}.png`);
  });

  test(`unit dialog pagination resets its own list at ${viewport.width}px`, async ({ page, baseURL, browserName }) => {
    await page.setViewportSize({ width: viewport.width, height: 640 });
    await installFixture(page, baseURL);
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Next accounts page', exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const reactPath = '/node_modules/.vite/deps/react.js', domPath = '/node_modules/.vite/deps/react-dom_client.js';
      const dialogPath = '/src/features/shoot-units/UnitManagerDialog.tsx', modelPath = '/src/features/shoot-units/model.ts';
      const React = (await import(reactPath)).default, { createRoot } = (await import(domPath)).default, { UnitManagerDialog } = await import(dialogPath), { makeUnitDraft } = await import(modelPath);
      document.getElementById('root')!.style.display = 'none';
      const host = document.createElement('div'); document.body.append(host);
      createRoot(host).render(React.createElement(UnitManagerDialog, { open: true, onClose: () => undefined, units: Array.from({ length: 24 }, (_, index) => makeUnitDraft({ label: `Pagination unit ${String(index + 1).padStart(2, '0')}`, sqft: 1000 })) }));
    });
    const dialog = page.getByRole('dialog', { name: 'Manage units', exact: true });
    const list = dialog.locator('[data-pagination-list]');
    await expect(dialog.getByText('Pagination unit 01', { exact: true })).toBeVisible();
    const next = dialog.getByRole('button', { name: 'Next', exact: true });
    await next.scrollIntoViewIfNeeded();
    await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await next.click();
    await expect(dialog.getByText('Pagination unit 09', { exact: true })).toBeVisible();
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(0);
    await dialog.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(dialog.getByText('Pagination unit 01', { exact: true })).toBeVisible();
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBe(0);
    await savePreview(page, `units-${browserName}-${viewport.width}.png`);
  });
}

for (const width of [390, 1440]) {
  test(`shoot history pagination returns to its first result at ${width}px`, async ({ page, baseURL, browserName }) => {
    await page.setViewportSize({ width, height: 900 });
    await installFixture(page, baseURL);
    let expectedNextAddress = '';
    await page.route('**/api/shoots?*', async route => {
      const url = new URL(route.request().url());
      const pageNumber = Number(url.searchParams.get('page') || 1), perPage = Number(url.searchParams.get('per_page') || 12);
      const first = (pageNumber - 1) * perPage;
      const scheduled = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
      const rows = Array.from({ length: Math.max(0, Math.min(perPage, 48 - first)) }, (_, index) => ({
        id: 5000 + first + index, address: `Pagination property ${String(first + index + 1).padStart(3, '0')}`, city: 'Baltimore', state: 'MD', zip: '21201',
        status: 'scheduled', workflow_status: 'scheduled', scheduled_date: scheduled, time: '10:00', timezone: 'America/New_York',
        client: { id: 10, name: 'Pagination Client', email: 'client@example.test' }, photographer: { id: 21, name: 'Pagination Photographer' },
        services: [{ id: 1, name: 'HDR Photos', price: 200, quantity: 1 }], base_quote: 200, total_quote: 200, total_paid: 0, payment_status: 'unpaid', files: [],
      }));
      if (pageNumber === 2) expectedNextAddress = rows[0]?.address || '';
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: rows, meta: { current_page: pageNumber, per_page: perPage, total: 48, count: 48, last_page: Math.ceil(48 / perPage), filters: { clients: [], photographers: [], salesReps: [], services: [] } } }) });
    });
    await page.goto('/shoot-history?tab=scheduled', { waitUntil: 'domcontentloaded' });
    const pager = page.locator('[data-shoot-history-pagination]').filter({ visible: true });
    await expect(pager).toBeVisible();
    const next = pager.getByRole('button', { name: 'Next', exact: true });
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await expect.poll(() => expectedNextAddress).not.toBe('');
    await expect(page.getByText(expectedNextAddress, { exact: true }).filter({ visible: true }).first()).toBeInViewport();
    await pager.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(page.getByText('Pagination property 001', { exact: true }).filter({ visible: true }).first()).toBeInViewport();
    await savePreview(page, `shoot-history-${browserName}-${width}.png`);
  });
}
