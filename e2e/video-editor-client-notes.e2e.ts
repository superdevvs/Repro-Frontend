import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const clientName = 'Morgan Client Review';
const companyNote = 'Use the client brand colours and include the property address in the opening title.';

async function installFixture(page: Page, baseURL: string | undefined, videoContext: boolean) {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
  const capabilities = videoContext ? ['video'] : ['photo'];
  const user = { id: 901, name: 'Editor Review', email: 'editor@example.test', role: 'editor',
    account_status: 'active', editing_capabilities: capabilities, email_verified_at: '2026-01-01',
    metadata: { editing_capabilities: capabilities, terms_accepted_at: '2026-01-01' } };
  let allowed = videoContext;
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(user => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('authToken', 'local-client-notes-fixture');
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'dark');
  }, user);
  await page.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.routeWebSocket(url => !['localhost', '127.0.0.1'].includes(url.hostname), socket => socket.close());
  await page.route('**/api/**', route => {
    const request = route.request(), apiPath = new URL(request.url()).pathname;
    const reply = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() !== 'GET') {
      if (apiPath.startsWith('/api/shoots/')) writes.push(`${request.method()} ${apiPath}`);
      return reply({ success: true, data: [] });
    }
    if (apiPath === '/api/user') return reply(user);
    if (apiPath === '/api/me/permissions') {
      const permissions = ['shoots', 'dashboard', 'dashboard-editor', 'shoot-history', 'settings'].map(resource => ({ resource, action: 'view' }));
      return reply({ permissionIds: permissions.map(p => `${p.resource}:${p.action}`), permissions });
    }
    if (apiPath === '/api/shoots/42') {
      const service = { id: 1, shoot_service_id: 11, name: 'Listing Video', upload_intake_type: 'video', requires_editing: true,
        editor_id: 902, video_editor_id: allowed ? 901 : 903, quantity: 1 };
      return reply({ data: { id: 42, address: '42 Context Review Lane', city: 'Test', state: 'MD', zip: '20850',
        status: 'editing', workflow_status: 'editing', services: [service], service_items: [service], service_objects: [service],
        can_view_video_editor_context: allowed, canViewVideoEditorContext: allowed,
        // Deliberately include legacy cached fields: the UI must still honour a revoked capability.
        client: { name: clientName, email: 'private-client@example.test', phone: '555-0109', company: 'Private Client Company' },
        company_notes: companyNote, editor_notes: 'Keep the video pacing relaxed.', files: [] } });
    }
    if (apiPath === '/api/shoots/42/notes') return reply({ data: [
      ...(allowed ? [{ id: 2, type: 'company', content: companyNote, visibility: 'internal' }] : []),
      { id: 1, type: 'editing', content: 'Keep the video pacing relaxed.', visibility: 'internal' },
    ] });
    return reply({ success: true, data: [], shoots: [], notifications: [], unread_count: 0, meta: { total: 0 } });
  });
  return { revoke: () => { allowed = false; }, writes, errors };
}

for (const width of [1440, 390]) {
  test(`scoped video task shows client context on dashboard and task brief at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
    const state = await installFixture(page, baseURL, true);
    const summary = { id: 42, dayLabel: 'Today', scheduledLocalDate: '2026-10-15', scheduledInstant: '2026-10-15T14:00:00Z',
      addressLine: '42 Context Review Lane', cityStateZip: 'Test, MD, 20850', status: 'editing', workflowStatus: 'editing',
      clientName, companyNotes: companyNote, canViewVideoEditorContext: true,
      hasScopedEditingTasks: true, hasPendingEditorWork: true, services: [{ label: 'Listing Video', type: 'video' }] };
    const task = { id: 'task-1', shoot_id: 42, address: summary.addressLine, scope: 'selected', instructions: 'Create the property video.',
      status: 'assigned', pending_items_count: 1, shoot: summary, items: [{ id: 'item-1', lane: 'video', destination: 'human', workflow: 'video', status: 'assigned', sources: [{ id: 7, name: 'Property walkthrough.mp4', version: 1 }] }] };
    await page.route('**/api/editing-tasks?**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [task], last_page: 1 }) }));
    await page.goto('/dashboard');
    const card = page.locator('[data-shoot-card="true"]').filter({ hasText: summary.addressLine }).first();
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card).toContainText(clientName);
    await expect(card).toContainText(companyNote);
    await card.click();
    expect(state.errors).toEqual([]);
    const brief = page.getByRole('dialog', { name: 'Editing tasks', exact: true });
    await expect(brief).toBeVisible();
    await expect(brief).toContainText(clientName);
    await expect(brief).toContainText(companyNote);
    await expect(brief.getByRole('button', { name: /^Edit$|^Save$/ })).toHaveCount(0);
    if (process.env.E2E_CLIENT_NOTES_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.E2E_CLIENT_NOTES_SCREENSHOTS, `video-task-context-${width}.png`), fullPage: true });
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
  for (const videoContext of [true, false]) {
    test(`${videoContext ? 'assigned video' : 'photo'} editor client context at ${width}px`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 1000 });
      const state = await installFixture(page, baseURL, videoContext);
      await page.goto('/shoots/42');
      const overview = page.getByRole('dialog');
      await expect(overview).toBeVisible();
      if (videoContext) await expect(overview.getByText(clientName, { exact: true }).first()).toBeVisible();
      else await expect(page.getByText(clientName, { exact: true })).toHaveCount(0);
      await expect(page.getByText('private-client@example.test', { exact: true })).toHaveCount(0);
      await expect(page.getByText('555-0109', { exact: true })).toHaveCount(0);
      await overview.getByRole('tab', { name: 'Notes', exact: true }).click();
      const company = overview.getByRole('region', { name: 'Company Notes', exact: true });
      if (videoContext) {
        await expect(company).toHaveText(companyNote);
        await expect(overview.getByRole('button', { name: /^Edit$|^Save$/ })).toHaveCount(0);
        await expect(overview.getByRole('textbox')).toHaveCount(0);
        if (process.env.E2E_CLIENT_NOTES_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.E2E_CLIENT_NOTES_SCREENSHOTS, `video-editor-notes-${width}.png`), fullPage: true });
      } else await expect(company).toHaveCount(0);
      expect(state.writes).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  }
  test(`video context disappears when revoked at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await installFixture(page, baseURL, true);
    await page.goto('/shoots/42');
    await expect(page.getByRole('dialog').getByText(clientName, { exact: true }).first()).toBeVisible();
    state.revoke();
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(clientName, { exact: true })).toHaveCount(0);
    await page.getByRole('dialog').getByRole('tab', { name: 'Notes', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Company Notes', exact: true })).toHaveCount(0);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}
