import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`video editor previews and downloads final images at ${width}px`, async ({ page, baseURL }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Local fixtures only');
    await page.setViewportSize({ width, height: 900 });
    const user = { id: 901, name: 'Video Editor', email: 'video@example.test', role: 'editor', editing_capabilities: ['video'], account_status: 'active', email_verified_at: '2026-01-01', metadata: { editing_capabilities: ['video'], terms_accepted_at: '2026-01-01' } };
    await page.addInitScript(user => {
      localStorage.clear(); localStorage.setItem('authToken', 'local-video-fixture');
      localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('theme', 'dark');
    }, user);
    const service = { id: 1, shoot_service_id: 11, name: 'Photos & Video', upload_intake_type: 'photo_video', requires_editing: true, editor_id: 902, video_editor_id: 901, price: 250, quantity: 1 };
    const shoot = { id: 42, address: '42 Test Lane', city: 'Test', state: 'MD', zip: '20850', status: 'editing', workflow_status: 'editing',
      services: [service], service_items: [service], service_objects: [service], client: { id: 10, name: 'Client' },
      total_quote: 250, total_paid: 250, payment_status: 'paid', raw_photo_count: 0, edited_photo_count: 2, files: [] };
    const image = '/studio-assets/hero-after.webp';
    const finals = [7, 8].map(id => ({ id, shoot_id: 42, shoot_service_id: 11, filename: `Final-${id}.jpg`,
      workflow_stage: 'completed', file_type: 'image/jpeg', media_type: 'edited', scan_status: 'clean',
      url: image, thumbnail_url: image, grid_url: image, web_url: image, original_url: image,
      can_download: true, can_interact: false, can_manage_visibility: false, can_set_hero: false, can_delete: false }));
    const requests: string[] = [];
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url()), path = url.pathname;
      const reply = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/api/user') return reply(user);
      if (path === '/api/me/permissions') return reply({ permissionIds: ['shoots:view', 'dashboard:view'], permissions: [{ resource: 'shoots', action: 'view' }] });
      if (path === '/api/shoots/42') return reply({ data: shoot });
      if (path === '/api/shoots/42/files') return reply({ data: url.searchParams.get('type') === 'raw' ? [] : finals });
      if (/\/media\/7\/download$/.test(path)) {
        requests.push('single');
        return route.fulfill({ contentType: 'image/jpeg', headers: { 'content-disposition': 'attachment; filename="Final-7.jpg"' }, body: 'image-fixture' });
      }
      if (path === '/api/shoots/42/files/download') {
        expect(req.postDataJSON().file_ids.sort()).toEqual(['7', '8']);
        requests.push('selected');
        return route.fulfill({ contentType: 'application/zip', headers: { 'content-disposition': 'attachment; filename="Final-photos.zip"' }, body: 'zip-fixture' });
      }
      if (req.method() !== 'GET' && path.startsWith('/api/shoots/')) requests.push(path);
      return reply({ success: true, data: [], shoots: [], notifications: [], unread_count: 0 });
    });
    await page.goto('/shoots/42');
    await expect(page.getByRole('tab', { name: /Media/i }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Photos \(/ })).toHaveCount(0);
    await page.getByRole('tab', { name: /^Edited/ }).click();
    await page.getByRole('button', { name: /^Photos \(2\)/ }).click();
    await expect(page.getByText('Final-7.jpg', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Raw.*Photos/ })).toHaveCount(0);
    await page.getByText('Final-7.jpg', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: /Download/i }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: /Rename filename|Set as hero|Delete file/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'List view', exact: true }).click();
    const single = page.getByRole('button', { name: 'Download image', exact: true }).first();
    const singleTransfer = page.waitForEvent('download');
    await single.click();
    await singleTransfer;
    if (width >= 640) await page.getByTitle('Select All', { exact: true }).click();
    else {
      await page.getByRole('checkbox', { name: 'Select Final-7.jpg', exact: true }).click();
      await page.getByRole('checkbox', { name: 'Select Final-8.jpg', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: /Rename|Mark as/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Download selected files', exact: true }).filter({ visible: true }).click();
    const zipTransfer = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: /Print Resolution/i }).click();
    await zipTransfer;
    expect(requests).toEqual(['single', 'selected']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
