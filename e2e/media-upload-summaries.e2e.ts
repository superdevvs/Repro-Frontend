import { expect, test, type Page } from '@playwright/test';
import { resolve, sep } from 'node:path';
import { existsSync, statSync } from 'node:fs';

const shootId = 920001;
async function fixture(page: Page, baseURL: string | undefined, role: string, initialCount = 8, servicesMode: 'single' | 'multiple' | 'unset' = 'single') {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('These fixtures must only run against a local dashboard.');
  // Also verify an exact production build using an already-running loopback
  // server. Assets and API fixtures are fulfilled locally, without new services.
  if (process.env.MEDIA_UPLOAD_STATIC_DIST) {
    const root = resolve(process.env.MEDIA_UPLOAD_STATIC_DIST);
    await page.route(`${baseURL}/**`, route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().resourceType() === 'document') return route.fulfill({ path: resolve(root, 'index.html') });
      const asset = resolve(root, `.${path}`);
      if (!path.startsWith('/api/') && asset.startsWith(`${root}${sep}`) && existsSync(asset) && statSync(asset).isFile()) return route.fulfill({ path: asset });
      return route.fallback();
    });
  }
  const user = { id: '900043', role, name: 'Media Test User', email: 'media@example.test', phone: '+15125550100', company: 'Fixture company', avatar: '/studio-assets/hero-after.webp', account_status: 'active', email_verified_at: '2026-01-01T00:00:00Z', metadata: { terms_accepted_at: '2026-01-01T00:00:00Z' } };
  await page.addInitScript(user => {
    if (localStorage.getItem('authToken') !== 'local-media-fixture') { localStorage.clear(); sessionStorage.clear(); }
    localStorage.setItem('authToken', 'local-media-fixture');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('theme', 'dark');
  }, user);
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/voice/browser/config') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ready: false, blockers: [], presence_verification: 'provider' }) });
    const value = path === '/api/user' ? user : path === '/api/me/permissions'
      ? { permissionIds: ['shoots:view', 'shoots:update', 'dashboard:view', 'accounts:view'], permissions: [{ resource: 'shoots', action: 'view' }] }
      : { success: true, data: [], notifications: [], unread_count: 0 };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
  });
  const files = Array.from({ length: initialCount }, (_, index) => ({
    id: index + 1, filename: `property-${index + 1}.jpg`, upload_type: 'raw', media_type: 'raw',
    file_type: 'image/jpeg', file_size: 2048, shoot_service_id: 11,
    grid_url: '/studio-assets/hero-after.webp', thumbnail_url: '/studio-assets/hero-after.webp',
    url: '/studio-assets/hero-after.webp', bracket_group: Math.floor(index / 5) + 1, sequence: index % 5 + 1,
  }));
  const summaries: Array<Record<string, unknown>> = initialCount ? [{ id: 'first', uploadType: 'raw', fileCount: initialCount, totalBytes: initialCount * 2048, completedAt: new Date().toISOString() }] : [];
  let summaryRequests = 0;
  let batch = 0;
  const service = { id: 1, shoot_service_id: 11, name: 'HDR Photos', photo_count: 25, upload_intake_type: 'photo', uses_hdr_brackets: true, effective_bracket_mode: 5, bracket_mode: 5, photographer_id: 900043, price: 250, quantity: 1 };
  const services = servicesMode === 'multiple' ? [
    { ...service, photo_count: 35 },
    { ...service, id: 2, shoot_service_id: 12, name: 'Aerial Photos', photo_count: 10, uses_hdr_brackets: false },
    { ...service, id: 3, shoot_service_id: 13, name: 'Twilight Photos', photo_count: 5, effective_bracket_mode: 3, bracket_mode: 3 },
    { ...service, id: 4, shoot_service_id: 14, name: 'Property Video', photo_count: undefined, upload_intake_type: 'video', uses_hdr_brackets: false },
  ] : [{ ...service, ...(servicesMode === 'unset' ? { photo_count: undefined, name: 'Variable Photos' } : {}) }];
  const shoot = {
    id: shootId, address: 'Media upload fixture', city: 'Austin', state: 'TX', zip: '78701',
    scheduled_date: '2026-10-15', time: '09:00', status: role === 'client' ? 'delivered' : 'scheduled', workflow_status: role === 'client' ? 'completed' : 'scheduled',
    client: { id: 900043, name: 'Fixture client' }, photographer: { id: 900043, name: 'Fixture photographer' },
    services, service_items: services, service_objects: services,
    base_quote: 250, total_quote: 250, total_paid: 250, payment_status: 'paid', bracket_mode: 5,
    expected_raw_count: servicesMode === 'multiple' ? 200 : servicesMode === 'unset' ? 0 : 125,
    expected_final_count: servicesMode === 'multiple' ? 50 : servicesMode === 'unset' ? 0 : 25, raw_photo_count: initialCount, files: [],
  };
  await page.route(`**/api/shoots/${shootId}**`, async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const reply = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path.endsWith('/upload-summaries')) { summaryRequests++; return reply({ data: summaries }, role === 'client' ? 403 : 200); }
    if (path.endsWith('/files')) return reply({ data: url.searchParams.get('type') === 'edited' ? [] : files });
    if (path.endsWith('/upload-batches')) { batch++; const body = req.postDataJSON(); return reply({ batch_id: body.batch_id, parallel_uploads: 1 }); }
    if (path.endsWith('/upload') && req.method() === 'POST') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const index = files.length;
      const accepted = { ...files[0], id: index + 1, filename: `uploaded-${index + 1}.jpg`, upload_type: 'raw', media_type: 'raw', file_type: 'image/jpeg', file_size: 2048, shoot_service_id: 11, grid_url: '/studio-assets/hero-after.webp', url: '/studio-assets/hero-after.webp', bracket_group: Math.floor(index / 5) + 1, sequence: index % 5 + 1 };
      files.push(accepted);
      summaries.unshift({ id: `batch-${batch}`, uploadType: 'raw', fileCount: 1, totalBytes: 2048, completedAt: new Date().toISOString() });
      return reply({ success_count: 1, error_count: 0, uploaded_files: [accepted] });
    }
    if (path === `/api/shoots/${shootId}`) return reply({ data: { ...shoot, raw_photo_count: files.length } });
    return reply({ data: [] });
  });
  await page.goto(`/shoots/${shootId}`);
  await expect(page.getByRole('tab', { name: /Media/i }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  // The actual shoot page defaults to Media, rather than a standalone mockup.
  return { files, summaries, summaryRequests: () => summaryRequests };
}

for (const role of ['admin', 'superadmin', 'editing_manager', 'photographer', 'salesRep']) {
  test(`${role} sees counts and dismissible summaries above the actual photos`, async ({ page, baseURL }) => {
    await fixture(page, baseURL, role);
    await expect(page.getByTestId('shoot-media-counts').first()).toContainText('8 / 125');
    await expect(page.getByTestId('upload-completion-summary')).toHaveCount(1);
    await expect(page.getByTestId('shoot-media-counts').first()).toContainText('Final target 25');
    await page.getByRole('button', { name: 'Dismiss upload summary', exact: true }).click();
    await expect(page.getByTestId('upload-completion-summary')).toHaveCount(0);
    await expect(page.getByTestId('shoot-media-counts').first()).toContainText('8 / 125');
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('shoot-media-counts').first()).toContainText('8 / 125');
    await expect(page.getByTestId('upload-completion-summary')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('shoot-media-counts').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('client never requests or sees staff summaries or counts', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, 'client');
  await expect(page.getByRole('tab', { name: /Media/i }).first()).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('shoot-media-counts')).toHaveCount(0);
  await expect(page.getByTestId('upload-completion-summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View shoot image requirements' })).toHaveCount(0);
  expect(state.summaryRequests()).toBe(0);
  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByTestId('shoot-media-counts')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View shoot image requirements' })).toHaveCount(0);
});

test('reduced motion keeps completion visible and dismisses without moving the photos', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fixture(page, baseURL, 'admin');
  await expect(page.getByTestId('upload-completion-summary')).toHaveCount(1);
  expect(await page.locator('.upload-complete-photos').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Dismiss upload summary', exact: true }).click();
  await expect(page.getByTestId('upload-completion-summary')).toHaveCount(0);
  await expect(page.getByTestId('shoot-media-counts').first()).toContainText('8 / 125');
});

test('empty shoot → first upload → second upload keeps photos and separate summaries', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1512, height: 1050 });
  const state = await fixture(page, baseURL, 'photographer', 0);
  await expect(page.getByTestId('shoot-media-empty-state')).toBeVisible();
  await expect(page.getByTestId('shoot-media-counts')).toHaveCount(1);
  await expect(page.getByTestId('shoot-media-counts')).toContainText('125');
  await expect(page.getByTestId('upload-completion-summary')).toHaveCount(0);
  for (const name of ['first.jpg', 'second.jpg']) {
    await page.getByRole('button', { name: /Upload Files|Upload More/i }).first().click();
    await page.getByTestId('raw-upload-input').setInputFiles({ name, mimeType: 'image/jpeg', buffer: Buffer.from('local fixture photo') });
    await page.getByRole('button', { name: 'Confirm & upload', exact: true }).click();
    await expect(page.getByTestId('upload-transfer-speed').first()).toBeVisible();
    await expect(page.getByTestId('upload-completion-summary')).toHaveCount(1);
    if (name === 'second.jpg') await expect(page.getByRole('button', { name: 'Next upload summary' })).toBeVisible();
    await expect(page.getByTestId('shoot-media-counts').first()).toContainText(name === 'first.jpg' ? '1 / 125' : '2 / 125');
  }
  expect(state.files).toHaveLength(2);
  if (process.env.MEDIA_UPLOAD_QA_DIR) {
    await page.waitForTimeout(3200);
    const grid = page.getByTitle('Grid view');
    if (await grid.count()) await grid.last().click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${process.env.MEDIA_UPLOAD_QA_DIR}/actual-dashboard-two-uploads.png`, fullPage: true });
  }
});

for (const role of ['admin', 'superadmin', 'editing_manager', 'photographer', 'salesRep']) {
  test(`${role} sees compact empty-state counts and service details without expanding the page`, async ({ page, baseURL }) => {
    await fixture(page, baseURL, role, 0);
    const empty = page.getByTestId('shoot-media-empty-state');
    await expect(empty).toBeVisible();
    await expect(page.getByTestId('shoot-media-counts')).toHaveCount(1);
    await expect(empty).toContainText('125');
    const before = await empty.boundingBox();
    await page.getByRole('button', { name: 'View shoot image requirements', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Shoot image requirements' });
    await expect(details).toContainText('25 final photos × 5 raw images');
    const after = await empty.boundingBox();
    expect(after?.height).toBe(before?.height);
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(empty).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'View shoot image requirements', exact: true }).click();
      await expect(details).toBeVisible();
      const box = await details.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.keyboard.press('Escape');
      await expect(details).toBeHidden();
    }
    if (process.env.MEDIA_UPLOAD_QA_DIR && role === 'photographer') {
      await page.setViewportSize({ width: 1512, height: 1050 });
      await page.screenshot({ path: `${process.env.MEDIA_UPLOAD_QA_DIR}/compact-empty-desktop.png`, fullPage: true, animations: 'disabled' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `${process.env.MEDIA_UPLOAD_QA_DIR}/compact-empty-mobile.png`, fullPage: true, animations: 'disabled' });
    }
  });
}

test('multiple services use their own brackets, exclude video totals and preserve requirements after upload', async ({ page, baseURL }) => {
  const state = await fixture(page, baseURL, 'photographer', 0, 'multiple');
  await expect(page.getByTestId('shoot-media-counts')).toContainText('200');
  await expect(page.getByTestId('shoot-media-counts')).toContainText('50');
  await page.getByRole('button', { name: 'View shoot image requirements', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Shoot image requirements' });
  await expect(details).toContainText('35 final photos × 5 raw images');
  await expect(details).toContainText('10 final photos × 1 raw image');
  await expect(details).toContainText('5 final photos × 3 raw images');
  await expect(details).toContainText('Property Video');
  await expect(details).toContainText('Video files are separate from photo counts');
  if (process.env.MEDIA_UPLOAD_QA_DIR) await page.screenshot({ path: `${process.env.MEDIA_UPLOAD_QA_DIR}/compact-service-details.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Upload Files|Upload More/i }).first().click();
  await page.getByTestId('raw-upload-input').setInputFiles({ name: 'hdr-first.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('local fixture photo') });
  await page.getByRole('button', { name: 'Confirm & upload', exact: true }).click();
  await expect(page.getByTestId('upload-completion-summary')).toHaveCount(1);
  await expect(page.getByTestId('shoot-media-empty-state')).toHaveCount(0);
  await expect(page.getByTestId('shoot-media-counts').first()).toContainText('1 / 200');
  await page.getByRole('button', { name: 'View shoot image requirements', exact: true }).first().click();
  await expect(details.locator('li').filter({ hasText: 'HDR Photos' })).toContainText('1 / 175');
  await expect(details.locator('li').filter({ hasText: 'Aerial Photos' })).toContainText('0 / 10');
  expect(state.files).toHaveLength(1);
});

test('unset service targets remain unset in the compact screen and details', async ({ page, baseURL }) => {
  await fixture(page, baseURL, 'admin', 0, 'unset');
  await expect(page.getByTestId('shoot-media-counts')).toContainText('Not set');
  await page.getByRole('button', { name: 'View shoot image requirements', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Shoot image requirements' })).toContainText('Photo count not set');
});
