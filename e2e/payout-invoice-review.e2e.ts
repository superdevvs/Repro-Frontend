import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';

async function fixture(page: Page, baseURL: string | undefined, role: string) {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
  const user = { id: 900501, name: 'Payout Review User', email: 'payout@example.test', role, account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } };
  await page.addInitScript(user => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('authToken', 'local-payout-fixture'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'dark'); }, user);
  const invoice = { id: 692, role: role === 'salesRep' ? 'salesRep' : 'photographer', photographer: { id: 900501, name: 'Delmar Review' }, salesRep: { id: 900501, name: 'Jaz Review' }, payee: { id: 900501, name: 'Delmar Review' }, photographer_id: 900501, sales_rep_id: null, status: 'draft', approval_status: role === 'admin' ? 'pending_approval' : 'pending', billing_period_start: '2026-09-27', billing_period_end: '2026-10-03', total_amount: 438.3, amount_paid: 0, is_paid: false, can_edit: true, unresolved_warnings: [], shoots: [], items: [{ id: 1, type: 'charge', description: 'Original HDR service', quantity: 1, unit_amount: 438.3, total_amount: 438.3 }], payout_review: { revision: 0, has_changes: false, label: role === 'admin' ? 'Confirmed unchanged' : 'Awaiting photographer', changes: [] as unknown[] } };
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  // Never send API traffic to production: every API request is fulfilled here.
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname.replace(/^\/api/, '');
    const body = req.postDataJSON() as Record<string, unknown> | null;
    if (req.method() !== 'GET') writes.push({ path: p, body: body || {} });
    if (p === '/user') return reply(route, user);
    if (p === '/me/permissions') { const permissions = ['view', 'manage', 'create', 'edit', 'approve'].map(action => ({ resource: 'accounting', action })).concat(['dashboard', 'shoots', 'accounts', 'availability', 'settings'].map(resource => ({ resource, action: 'view' }))); return reply(route, { permissions, permissionIds: permissions.map(x => `${x.resource}:${x.action}`) }); }
    if (p.endsWith('/shoot-candidates')) return reply(route, { data: [{ shoot_id: 641, shoot_service_id: 743, address: '3325 Dudley Avenue', service_name: '25 HDR Photos', amount: 78.75, scheduled_date: '2026-10-04', completed_date: '2026-10-05', earning_week: '2026-10-04 – 2026-10-10', outside_period: true, eligible: true }] });
    if (p.endsWith('/edit')) return reply(route, { invoice });
    if (/\/edit\/items/.test(p)) {
      if (req.method() === 'PATCH') Object.assign(invoice.items[0], { description: body!.description, unit_amount: body!.amount, total_amount: Number(body!.amount) * Number(body!.quantity) });
      else invoice.items.push({ id: 2, type: body!.action === 'add_expense' ? 'expense' : 'charge', description: body!.action === 'add_shoot' ? 'Shoot #641 - 3325 Dudley Avenue - 25 HDR Photos' : String(body!.description), quantity: 1, unit_amount: Number(body!.amount || 78.75), total_amount: Number(body!.amount || 78.75) });
      invoice.total_amount = invoice.items.reduce((sum, item) => sum + item.total_amount, 0); invoice.payout_review.revision++; invoice.payout_review.has_changes = true; invoice.payout_review.changes.push({ summary: 'Invoice corrected.', metadata: { reason: body!.reason } });
      invoice.payout_review.label = role === 'admin' ? 'Accounts corrected' : role === 'salesRep' ? 'Awaiting sales rep' : 'Awaiting photographer';
      if (body!.reconcile_history) Object.assign(invoice.payout_review, { recovery_required: null });
      return reply(route, { invoice }, req.method() === 'POST' ? 201 : 200);
    }
    if (p.endsWith('/submit-for-approval')) { invoice.approval_status = 'pending_approval'; invoice.can_edit = false; invoice.payout_review.label = 'Changes submitted'; return reply(route, { invoice, message: 'Submitted' }); }
    if (p.endsWith('/approve')) { invoice.approval_status = 'approved'; invoice.can_edit = false; return reply(route, { invoice, message: 'Approved' }); }
    if (p.endsWith('/review-queue')) return reply(route, { data: [invoice], total: 1, current_page: 1, last_page: 1, per_page: 15, summary: { invoice_count: 1, total_amount: invoice.total_amount, needs_review_count: 1, approved_count: 0, returned_count: 0 } });
    if (p.endsWith('/review-detail')) return reply(route, { data: invoice });
    if (/\/invoices\/692$/.test(p)) return reply(route, invoice);
    if (p === '/photographer/invoices' || p === '/salesrep/invoices') return reply(route, { data: [invoice], total: 1, current_page: 1, last_page: 1 });
    if (p === '/invoices/summary') return reply(route, { data: { invoice_count: 0, total_amount: 0, total_paid: 0, outstanding_amount: 0, by_status: {}, by_payment_method: {} } });
    if (p === '/notifications') return reply(route, { data: { activity_log: [], unread_count: 0 } });
    return reply(route, { data: [], shoots: [], total: 0, current_page: 1, last_page: 1, success: true });
  });
  return { writes, invoice };
}

test('External work requires its job identity and explanation before adding', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { writes } = await fixture(page, baseURL, 'photographer');
  await page.goto('/accounting');
  await page.getByRole('button', { name: 'Edit invoice', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add external / legacy work' }).click();
  await expect(dialog.getByRole('button', { name: 'Add to invoice' })).toBeDisabled();
  await dialog.getByLabel('Service / work description').fill('25 HDR Photos - Edgemere');
  await dialog.getByLabel('Payout amount').fill('78.75');
  await dialog.getByLabel('Work date', { exact: true }).fill('2026-09-27');
  await dialog.getByLabel('Original job ID / URL').fill('viewshoot:1626:466152');
  await dialog.getByLabel('Address', { exact: true }).fill('4953 Edgemere Avenue');
  await expect(dialog.getByRole('button', { name: 'Add to invoice' })).toBeDisabled();
  await dialog.getByLabel('Explanation (required)', { exact: true }).fill('Legacy import excluded this completed job.');
  await dialog.getByRole('button', { name: 'Add to invoice' }).click();
  await expect(dialog.getByText('25 HDR Photos - Edgemere', { exact: true })).toBeVisible();
  expect(writes.find(x => x.path.endsWith('/edit/items'))?.body).toMatchObject({ action: 'add_external', reference: 'viewshoot:1626:466152', amount: 78.75 });
  await expect(dialog.getByRole('button', { name: 'Submit changes' })).toBeDisabled();
});

test('Paid invoices stay viewable but locked', async ({ page, baseURL }) => {
  const { writes, invoice } = await fixture(page, baseURL, 'admin');
  invoice.status = 'paid'; invoice.is_paid = true; invoice.can_edit = false;
  await page.goto('/accounting');
  await page.getByRole('navigation', { name: 'Accounting sections' }).getByRole('button', { name: 'Photographers', exact: true }).click();
  await page.getByRole('button', { name: 'View invoice', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Original HDR service', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Edit invoice', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Approve amount' })).toHaveCount(0);
  expect(writes.filter(x => /invoices/.test(x.path))).toHaveLength(0);
});

test('Failed editor load cannot submit stale invoice data', async ({ page, baseURL }) => {
  const { writes } = await fixture(page, baseURL, 'photographer');
  await page.route('**/api/**', route => new URL(route.request().url()).pathname.endsWith('/edit')
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unable to load invoice' }) }) : route.fallback());
  await page.goto('/accounting');
  await page.getByRole('button', { name: 'View invoice', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toHaveText('Unable to load invoice');
  await expect(dialog.getByRole('button', { name: 'Confirm invoice is correct' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Edit invoice', exact: true })).toHaveCount(0);
  expect(writes.filter(x => /invoices/.test(x.path))).toHaveLength(0);
});

test('Accounts sees return history and must explicitly reconcile historical loss', async ({ page, baseURL }) => {
  const { writes, invoice } = await fixture(page, baseURL, 'admin');
  Object.assign(invoice.payout_review, { last_return_reason: 'Please add the missing shoots.', recovery_required: { message: 'Historical regeneration changed this invoice after a manual edit.', before_total: 595.8, after_total: 438.3, recalculation_id: 10 } });
  await page.goto('/accounting');
  await page.getByRole('navigation', { name: 'Accounting sections' }).getByRole('button', { name: 'Photographers', exact: true }).click();
  await page.getByRole('button', { name: 'View invoice', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Please add the missing shoots.', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Before regeneration \$595.80; after \$438.30/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Approve amount' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Verify the warnings or provide an accounts override reason.');
  expect(writes.filter(x => /invoices/.test(x.path))).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Edit invoice', exact: true }).click();
  await dialog.getByLabel('Reason for correction (required)').fill('Checked all historical work and payout records.');
  await dialog.getByRole('checkbox', { name: /I reconciled every historical edit/ }).check();
  await dialog.getByRole('button', { name: 'Edit line' }).click();
  await dialog.getByLabel('Unit amount').fill('595.80');
  await dialog.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(dialog.getByText('Accounts verification required')).toHaveCount(0);
  expect(writes.find(x => x.path.includes('/edit/items/'))?.body.reconcile_history).toBe(true);
});

for (const width of [1440, 390]) for (const role of ['photographer', 'salesRep', 'admin']) {
  test(`Payout editor ${role} ${width}px`, async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    const { writes } = await fixture(page, baseURL, role);
    await page.goto('/accounting');
    if (role === 'admin') await page.getByRole('navigation', { name: 'Accounting sections' }).getByRole('button', { name: 'Photographers', exact: true }).click();
    await page.getByRole('button', { name: 'View invoice', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Original HDR service', { exact: true })).toBeVisible();
    expect(writes.filter(x => /invoices/.test(x.path))).toHaveLength(0);
    await dialog.getByRole('button', { name: 'Edit invoice', exact: true }).click();
    if (role === 'admin') await dialog.getByLabel('Reason for correction (required)').fill('Verified missing shoot with legacy record.');
    if (role === 'salesRep') {
      await dialog.getByRole('button', { name: 'Add adjustment' }).click();
      await dialog.getByLabel('Description', { exact: true }).fill('Travel correction');
      await dialog.getByLabel('Payout amount').fill('35');
      await dialog.getByRole('button', { name: 'Add to invoice' }).click();
      await expect(dialog.getByText('Travel correction', { exact: true })).toBeVisible();
    } else {
      await dialog.getByRole('button', { name: 'Add shoot', exact: true }).click();
      await expect(dialog.getByText('Shot outside this invoice week')).toBeVisible();
      if (role !== 'admin') await expect(dialog.getByRole('button', { name: 'Add service' })).toBeDisabled();
      await dialog.getByLabel('Reason for adding / moving work').fill('Shot Saturday; include in this earning week.');
      await dialog.getByRole('button', { name: 'Add service' }).click();
      await expect(dialog.getByText('Shoot #641 - 3325 Dudley Avenue - 25 HDR Photos', { exact: true })).toBeVisible();
    }
    expect(await dialog.evaluate(node => node.getBoundingClientRect().width <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.resolve('test-results', `payout-${role}-${width}.png`) });
    if (role === 'admin') await dialog.getByRole('button', { name: 'Approve amount' }).click();
    else {
      await expect(dialog.getByRole('button', { name: 'Submit changes' })).toBeDisabled();
      await dialog.getByLabel('Explanation of changes (required)').fill('Added the missing work listed above.');
      await dialog.getByRole('button', { name: 'Submit changes' }).click();
    }
    await expect(dialog).not.toBeVisible();
    expect(writes.filter(x => /invoices/.test(x.path))).toHaveLength(2);
    expect(writes.find(x => /submit-for-approval|approve/.test(x.path))?.body.expected_revision).toBe(1);
    expect(errors).toEqual([]);
  });
}

for (const width of [1440, 390]) for (const role of ['photographer', 'salesRep', 'admin']) {
  test(`Shoot dates newest first with one shoot number ${role} ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const { invoice, writes } = await fixture(page, baseURL, role);
    Object.assign(invoice, {
      shoots: [{ id: 134, scheduled_date: '2026-09-27T00:00:00Z', completed_at: '2026-10-07' }, { id: 145, scheduled_date: '2026-10-03', completed_at: '2026-10-04' }],
      items: [
        { id: 1, shoot_id: 134, type: 'charge', description: 'Shoot #134 - Herberts Crossing - HDR Photos', quantity: 1, unit_amount: 213.75, total_amount: 213.75, recorded_at: '2026-10-07' },
        { id: 2, shoot_id: 145, type: 'charge', description: 'Shoot #145 - Center Street - HDR Photos', quantity: 1, unit_amount: 258.75, total_amount: 258.75 },
        { id: 3, type: 'charge', description: 'Legacy Edgemere work', quantity: 1, unit_amount: 78.75, total_amount: 78.75, meta: { source: 'external_work', work_date: '2026-09-29' } },
      ],
    });
    await page.goto('/accounting');
    if (role === 'admin') await page.getByRole('navigation', { name: 'Accounting sections' }).getByRole('button', { name: 'Photographers', exact: true }).click();
    await page.getByRole('button', { name: 'View invoice', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    const lines = dialog.locator('[aria-label="Invoice lines"] > div');
    await expect(lines.nth(0)).toContainText('Oct 3, 2026');
    await expect(lines.nth(0)).toContainText('Shoot #145');
    await expect(lines.nth(1)).toContainText('Sep 29, 2026');
    await expect(lines.nth(2)).toContainText('Sep 27, 2026');
    expect((await lines.nth(0).innerText()).match(/Shoot #145/g)).toHaveLength(1);
    expect((await lines.nth(2).innerText()).match(/Shoot #134/g)).toHaveLength(1);
    await dialog.getByRole('button', { name: 'Edit invoice', exact: true }).click();
    await expect(lines.nth(0)).toContainText('Oct 3, 2026');
    await expect(lines.nth(2)).toContainText('Sep 27, 2026');
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(writes.filter(write => /invoices/.test(write.path))).toHaveLength(0);
    await page.screenshot({ path: path.resolve('test-results', `invoice-dates-${role}-${width}.png`) });
  });
}

test('Saturday shoot completed Sunday needs no cross-week reason', async ({ page, baseURL }) => {
  const { writes } = await fixture(page, baseURL, 'photographer');
  await page.route('**/api/**', route => new URL(route.request().url()).pathname.endsWith('/shoot-candidates')
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ shoot_id: 379, shoot_service_id: 796, address: '3254 Gleneagles Dr', service_name: '30 HDR Photos + Floor plans', amount: 121.5, scheduled_date: '2026-10-03', completed_date: '2026-10-04', earning_week: '2026-09-27 – 2026-10-03', outside_period: false, eligible: true }] }) }) : route.fallback());
  await page.goto('/accounting');
  await page.getByRole('button', { name: 'Edit invoice', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Add shoot', exact: true }).click();
  await expect(dialog.getByText(/Invoice week 2026-09-27 – 2026-10-03/)).toBeVisible();
  await expect(dialog.getByText('Shot outside this invoice week')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Add service' })).toBeEnabled();
  expect(writes.filter(write => /invoices/.test(write.path))).toHaveLength(0);
});
