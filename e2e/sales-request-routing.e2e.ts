import { expect, test, type Page } from '@playwright/test';
import { installDashboardMobileFixtures } from './helpers/dashboard-mobile-fixtures';

const shootId = 920001;
const now = new Date().toISOString();
const issue = { id: 'client-request-1', shootId, note: 'Please confirm property access with my sales rep', status: 'open', raisedBy: { id: '940001', name: 'Fixture Client', role: 'client' }, createdAt: now, updatedAt: now, shoot: { id: shootId, address: 'Sales client property' } };
const shoot = {
  id: shootId, address: 'Sales client property', city: 'Austin', state: 'TX', zip: '78701', scheduled_date: now.slice(0, 10), time: '10:00',
  status: 'scheduled', workflow_status: 'scheduled', client: { id: 940001, name: 'Fixture Client', email: 'client@example.test', email_verified: true },
  photographer: { id: 910001, name: 'Assigned Photographer' }, services: [{ id: 1, name: 'Photography', price: 250, quantity: 1, photographer_id: 910001 }],
  base_quote: 250, total_quote: 250, total_paid: 250, payment_status: 'paid', files: [], is_flagged: false, can_view_invoice: true,
};

async function fixtures(page: Page, baseURL: string | undefined, role: 'admin' | 'salesRep', repId: number | null = 900043) {
  const state = await installDashboardMobileFixtures(page, baseURL, role, true);
  const previews: Record<string, string>[] = [];
  const sends: Record<string, string>[] = [];
  const writes: string[] = [];
  const assignments: { assignedToRole: string }[] = [];
  let currentIssue = { ...issue };
  const scopedShoot = {
    ...shoot,
    client: { ...shoot.client, rep: { id: 900043, name: 'Client Account Rep' } },
    rep_id: repId,
    rep: repId ? { id: repId, name: 'Assigned Sales Rep' } : null,
  };
  await page.route('**/api/voice/browser/config', route => route.fulfill({ json: { enabled: false, ready: false, blockers: [], presence_verification: 'provider' } }));
  await page.route('**/api/system-telemetry/events', route => route.fulfill({ json: { accepted: true } }));
  await page.route('**/api/client-requests', route => route.fulfill({ json: { data: [issue] } }));
  await page.route(/\/api\/shoots(?:[/?]|$)/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== 'GET') writes.push(path);
    if (path.endsWith('/pending-cancellations')) return route.fulfill({ json: { data: [{ id: shootId, address: 'Cancellation for sales rep', client: { name: 'Fixture Client' }, cancellation_reason: 'Client changed plans' }] } });
    if (path.endsWith('/pending-holds')) return route.fulfill({ json: { data: [{ id: shootId, address: 'Hold for sales rep', client: { name: 'Fixture Client' }, hold_reason: 'Waiting for access' }] } });
    if (path.endsWith('/pending-reschedules')) return route.fulfill({ json: { data: [{ id: 7, shoot_id: shootId, status: 'pending', address: 'Reschedule for sales rep', original_date: now.slice(0, 10), requested_date: '2026-10-12', reason: 'Client needs another day' }] } });
    if (path === `/api/shoots/${shootId}`) return route.fulfill({ json: { data: scopedShoot } });
    if (path === `/api/shoots/${shootId}/issues/${issue.id}/assign` && request.method() === 'POST') {
      const payload = request.postDataJSON();
      assignments.push(payload);
      currentIssue = { ...currentIssue, ...payload };
      return route.fulfill({ json: { data: currentIssue } });
    }
    if (path.endsWith('/issues')) return route.fulfill({ json: { data: [currentIssue] } });
    if (path.endsWith('/files')) return route.fulfill({ json: { data: [] } });
    if (path === '/api/shoots' && url.searchParams.get('scheduled_status') === 'requested') return route.fulfill({ json: { data: [{ ...shoot, id: 920099, address: 'Scheduling request for sales rep', status: 'requested', workflow_status: 'requested' }], meta: { last_page: 1, current_page: 1, total: 1 } } });
    return route.fallback();
  });
  await page.route('**/api/messaging/notifications/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/recipients')) {
      const recipient = url.searchParams.get('recipient_type');
      return route.fulfill({ json: { shoot_id: shootId, recipients: [{ id: recipient === 'rep' ? 9 : 10, name: recipient === 'rep' ? 'Alex Sales Representative' : recipient === 'photographer' ? 'Assigned Photographer' : 'Fixture Client', email: `${recipient}@example.test`, recipient_type: recipient }] } });
    }
    const payload = request.postDataJSON();
    if (url.pathname.endsWith('/manual-preview')) {
      previews.push(payload);
      return route.fulfill({ json: { subject: 'Shoot notification preview', body_html: `<p>${payload.type} notification for ${payload.recipient_type}</p>`, body_text: `${payload.type} notification for ${payload.recipient_type}`, missing_variables: [] } });
    }
    if (url.pathname.endsWith('/manual-send')) {
      sends.push(payload);
      return route.fulfill({ json: { status: 'sent', channel: payload.channel, recipient_type: payload.recipient_type, message_id: 1 } });
    }
    return route.fulfill({ status: 501, json: { message: 'Unmocked notification operation' } });
  });
  return { ...state, previews, sends, writes, assignments };
}

test.use({ video: 'off' });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`sales request queues load at ${viewport.width}px without admin dashboard permission`, async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const state = await fixtures(page, baseURL, 'salesRep');
    await page.goto('/dashboard');
    await expect(page.locator('[data-page-loading]')).toHaveAttribute('data-page-loading', 'ready');
    if (viewport.width < 1025) await page.getByRole('tab', { name: 'Requests', exact: true }).click();
    const queue = page.locator('#requests-queue');
    for (const name of ['Client', 'Cancellation', 'Hold', 'Reschedule']) await expect(queue.getByRole('button', { name: `${name} (1)`, exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('sales-request-queues.png') });
    await queue.getByRole('button', { name: 'Client (1)', exact: true }).click();
    await expect(queue.getByText(issue.note)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('sales-client-request.png') });
    await queue.getByRole('button', { name: 'Back to Requests' }).click();
    await queue.getByRole('button', { name: 'Cancellation (1)', exact: true }).click();
    await expect(queue.getByText('Cancellation for sales rep')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('sales-cancellation-request.png') });
    await queue.getByRole('button', { name: 'Back to Requests' }).click();
    await queue.getByRole('button', { name: 'Hold (1)', exact: true }).click();
    await expect(queue.getByText('Hold for sales rep')).toBeVisible();
    await queue.getByRole('button', { name: 'Back to Requests' }).click();
    await queue.getByRole('button', { name: 'Reschedule (1)', exact: true }).click();
    await expect(queue.getByText('Reschedule for sales rep')).toBeVisible();
    await expect(queue.getByRole('button', { name: 'Approve reschedule', exact: true })).toBeVisible();
    expect(state.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('manual hold and cancellation previews use reps and reset incompatible selections', async ({ page, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = await fixtures(page, baseURL, 'admin');
  await page.goto(`/shoots/${shootId}`);
  // Shoot pages open their overview after loading; close it before using the sidebar action.
  const overview = page.getByRole('dialog', { name: /Sales client property/ });
  await expect(overview).toBeVisible();
  await overview.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Notify', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Notify', exact: true }) });
  const selectType = async (label: string) => {
    await dialog.getByRole('combobox', { name: 'Notification', exact: true }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
  };
  await dialog.getByRole('button', { name: 'Photographer', exact: true }).click();
  await selectType('Shoot cancelled');
  await expect(dialog.getByRole('button', { name: 'Photographer', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await dialog.getByRole('button', { name: 'Photographer', exact: true }).evaluate(button => {
    const bounds = button.getBoundingClientRect();
    const control = button.parentElement!.getBoundingClientRect();
    const dialogBounds = button.closest('[role="dialog"]')!.getBoundingClientRect();
    return button.scrollWidth <= button.clientWidth && bounds.left >= control.left && bounds.right <= control.right
      && bounds.left >= dialogBounds.left && bounds.right <= dialogBounds.right;
  })).toBe(true);
  await expect(dialog.getByText('shoot_cancelled notification for photographer', { exact: true })).toBeVisible();
  await expect(dialog.getByTestId('manual-notification-recipients').getByRole('listitem')).toContainText('Assigned Photographer');
  await page.screenshot({ path: testInfo.outputPath('shoot_cancelled-photographer-preview.png') });
  await dialog.getByRole('button', { name: 'Sales rep', exact: true }).click();
  await expect(dialog.getByText('Alex Sales Representative', { exact: false })).toBeVisible();
  await expect(dialog.getByText('shoot_cancelled notification for rep', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('shoot_cancelled-rep-preview.png') });
  await selectType('Shoot on hold');
  await expect(dialog.getByRole('button', { name: 'Photographer', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Sales rep', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByText('shoot_on_hold notification for rep', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('shoot_on_hold-rep-preview.png') });
  await selectType('Shoot cancelled');
  await expect(dialog.getByRole('button', { name: 'Sales rep', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Photographer', exact: true }).click();
  await selectType('Shoot on hold');
  await expect(dialog.getByRole('button', { name: 'Client', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Photographer', exact: true })).toHaveCount(0);
  await selectType('Shoot cancelled');
  await dialog.getByRole('button', { name: 'Sales rep', exact: true }).click();
  await selectType('Shoot scheduled');
  await expect(dialog.getByRole('button', { name: 'Client', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Photographer', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sales rep', exact: true })).toHaveCount(0);
  expect(state.previews.some(payload => payload.type === 'shoot_on_hold' && payload.recipient_type === 'photographer')).toBe(false);
  expect(state.previews.some(payload => payload.type === 'shoot_scheduled' && payload.recipient_type === 'rep')).toBe(false);
  expect(state.sends).toEqual([]);
  expect(errors).toEqual([]);
});

test('assigned sales rep can create requests without staff assignment controls', async ({ page, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const state = await fixtures(page, baseURL, 'salesRep');
  await page.goto(`/shoots/${shootId}#requests`);
  await expect(page.getByText(issue.note, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add request', exact: true }).click();
  await page.getByRole('button', { name: 'Create Request', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create Request', exact: true })).toBeVisible();
  await expect(page.getByText('Assign to role', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('sales-create-request.png'), animations: 'disabled' });
  expect(state.writes).toEqual([]);
  expect(errors).toEqual([]);
});

for (const repId of [900099, null]) {
  test(`sales rep can triage existing requests but cannot create for ${repId ? 'another rep' : 'an unassigned shoot'}`, async ({ page, baseURL }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const state = await fixtures(page, baseURL, 'salesRep', repId);
    await page.goto(`/shoots/${shootId}#requests`);
    await expect(page.getByText(issue.note, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add request', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create Request', exact: true })).toHaveCount(0);
    const manager = page.getByRole('dialog', { name: 'Request Manager', exact: true });
    await page.getByRole('button', { name: 'Manage requests', exact: true }).click();
    await expect(manager.getByRole('button', { name: 'Create Request', exact: true })).toHaveCount(0);
    if (repId) {
      await manager.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Assign', exact: true }).click();
    } else {
      await manager.getByRole('button', { name: 'Assign request', exact: true }).click();
    }
    await page.getByRole('menuitem', { name: 'Assign to Editor', exact: true }).click();
    await expect.poll(() => state.assignments).toEqual([{ assignedToRole: 'editor' }]);
    if (!repId) await manager.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Assigned', exact: true })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('sales-existing-request-triage.png'), animations: 'disabled' });
    expect(state.writes).toEqual([`/api/shoots/${shootId}/issues/${issue.id}/assign`]);
    expect(state.requests.some(request => request.path === '/admin/users')).toBe(false);
    expect(errors).toEqual([]);
  });
}
