import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) for (const lane of ['edited', 'uploaded'] as const) {
  test(`editor request opens ${lane} photos with downloads and orange strokes at ${width}px`, async ({ page, baseURL }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
    await page.setViewportSize({ width, height: 900 });
    const user = { id: 901, name: 'Editor Review', email: 'editor@example.test', role: 'editor', account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' } };
    await page.addInitScript(user => { localStorage.clear(); localStorage.setItem('authToken', 'local-editor-fixture'); localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'dark'); }, user);
    const image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="480"%3E%3Crect width="640" height="480" fill="%23486b48"/%3E%3C/svg%3E';
    const file = { id: '7', shoot_id: 42, filename: 'Requested.jpg', workflow_stage: lane === 'edited' ? 'verified' : 'todo', file_type: 'image/jpeg', mime_type: 'image/jpeg', thumbnail_url: image, grid_url: image, url: image, has_open_request: true, scan_status: 'clean', media_type: lane === 'edited' ? 'edited' : 'raw' };
    const request = { id: 'request-1', shootId: 42, note: 'Please add green grass', status: 'open', assignedToRole: 'editor', raisedBy: { name: 'Client', role: 'client' }, canOpenShoot: true, canUpdate: true, mediaIds: ['7'], mediaFiles: [{ id: '7', filename: file.filename, thumbnail: image, workflowStage: file.workflow_stage, canDownload: true }], shoot: { id: 42, address: '42 Test Lane', client: { id: 10, name: 'Client' } }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const shoot = { id: 42, status: 'completed', workflow_status: 'editing_review', address: '42 Test Lane', location: { address: '42 Test Lane', city: 'Test', state: 'MD', zip: '20850' }, client: { id: 10, name: 'Client' }, services: [], serviceItems: [], payment: { totalQuote: 100, totalPaid: 100, paymentStatus: 'paid' }, total_quote: 100, total_paid: 100, payment_status: 'paid', raw_photo_count: lane === 'uploaded' ? 1 : 0, edited_photo_count: lane === 'edited' ? 1 : 0 };
    const writes: string[] = [];
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()); const path = url.pathname.replace(/^\/api/, '');
      if (route.request().method() !== 'GET') writes.push(path);
      const reply = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/user') return reply(user);
      if (path === '/me/permissions') { const permissions = ['dashboard', 'dashboard-editor', 'shoots', 'shoot-history', 'settings'].map(resource => ({ resource, action: 'view' })); return reply({ permissions, permissionIds: permissions.map(p => `${p.resource}:${p.action}`) }); }
      if (path === '/client-requests' || path === '/shoots/42/issues') return reply({ data: [request] });
      if (path === '/shoots/42') return reply({ data: shoot });
      if (path === '/shoots/42/files') { const type = url.searchParams.get('type'); return reply({ data: !type || type === 'all' || type === (lane === 'edited' ? 'edited' : 'raw') ? [file] : [] }); }
      if (path === '/shoots/42/media/7/download') return route.fulfill({ contentType: 'image/jpeg', headers: { 'content-disposition': 'attachment; filename="Requested.jpg"' }, body: 'original-photo-fixture' });
      return reply({ data: [], shoots: [], success: true, meta: { total: 0 } });
    });
    await page.goto('/dashboard');
    if (width < 1024) await page.getByRole('tab', { name: 'Requests', exact: true }).click();
    await page.locator('#requests-queue').getByRole('button', { name: 'Client (1)', exact: true }).click();
    await page.getByRole('button', { name: 'View all client', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Resolve', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open shoot', exact: true }).click();
    const download = page.getByRole('button', { name: 'Download Requested.jpg', exact: true });
    await expect(download).toBeVisible();
    const downloaded = page.waitForEvent('download');
    await download.click();
    expect((await downloaded).suggestedFilename()).toBe('Requested.jpg');
    if (width < 640) await page.getByRole('tab', { name: 'Media', exact: true }).click();
    const mediaTab = page.getByRole('tab', { name: lane === 'edited' ? /^Edited \(/ : /^Raw.*\(/ });
    await expect(mediaTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.ring-orange-500:visible').filter({ hasText: 'Requested.jpg' }).first()).toBeVisible();
    await page.screenshot({ path: `test-results/request-media-${lane}-${width}.png`, fullPage: true });
    expect(writes.filter(path => /\/issues/.test(path))).toEqual([]);
  });
}
