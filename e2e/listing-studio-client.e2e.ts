import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installStudioFixtures } from './helpers/studio-v4-fixtures';
import fixtures from '../src/components/listing-studio/client/studioFixtures.test-data.json' with { type: 'json' };
import type { StudioAccount, StudioOrder } from '../src/types/listingStudioClient';

async function install(page: Page, baseURL: string | undefined) {
  await installStudioFixtures(page, baseURL, [], 'client');
  await page.addInitScript(() => { localStorage.setItem('theme', 'dark'); localStorage.setItem('onboarding_complete', 'true'); });
  const account = structuredClone(fixtures.account) as StudioAccount;
  const order: StudioOrder = { ...(structuredClone(fixtures.order) as StudioOrder), funding: { ...fixtures.order.funding, method: 'card', status: 'settled', paidAmountCents: 700, reservedCreditCents: 0 }, item: { ...fixtures.order.item, status: 'completed', previewAvailable: true, downloadAvailable: true, completedAt: '2026-11-04T00:00:00Z' }, actions: { canCheckout: false, canCancel: false, canDownload: true, canRequestRevision: true }, aiRevisions: { limit: 3, used: 0, remaining: 3, canRequest: true, active: null, versions: [{ id: 'initial', number: 0, createdAt: '2026-11-04T00:00:00Z' }] } };
  const requests: { method: string; path: string; key?: string }[] = [];
  let failRevision = false;
  await page.route('**/api/listing-studio/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname.replace('/api/listing-studio/', ''); const method = request.method();
    requests.push({ method, path, key: request.headers()['idempotency-key'] });
    const data = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data: value }) });
    if (path === 'client/catalog') return data(fixtures.catalog);
    if (path === 'client/account') return data(account);
    if (path === 'client/transactions') return data({ transactions: [], pagination: { page: 1, perPage: 20, total: 0, hasMore: false } });
    if (path === 'trials') return data({ trials: [] });
    if (path === 'client/orders' && method === 'GET') return data({ orders: [order], pagination: { page: 1, perPage: 12, total: 1, hasMore: false } });
    if (path === `client/orders/${order.id}`) return data({ order });
    if (path.endsWith('/preview') || path.endsWith('/download')) return route.fulfill({ status: 200, contentType: 'image/webp', path: resolve(`public/studio-assets/hero-${url.searchParams.get('variant') === 'original' ? 'before' : 'after'}.webp`) });
    if (path === 'client/uploads') return data({ upload: { id: '00000000-0000-4000-8000-000000000003', originalPreviewAvailable: true, expiresAt: '2099-01-01T00:00:00Z' } });
    if (path === 'client/quotes') return data({ quote: { ...fixtures.quote, kind: 'ai_edit', service: 'staging', instructions: undefined, pricing: { ...fixtures.quote.pricing, basePriceCents: 1500, totalPriceCents: 1500, creditCostCents: 1500, discountCents: 0, discountPercent: 0 } } });
    if (path.endsWith('/ai-revisions')) {
      if (failRevision) { failRevision = false; return route.abort('failed'); }
      order.aiRevisions = { ...order.aiRevisions!, used: 1, remaining: 2, canRequest: false, active: { id: '00000000-0000-4000-8000-000000000011', number: 1, status: 'queued', progress: null, error: null } };
      return data({ order, revisionId: order.aiRevisions.active!.id }, 202);
    }
    return route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ message: `Unmocked Listing Studio request: ${method} ${path}` }) });
  });
  return { account, order, requests, failNextRevision: () => { failRevision = true; } };
}
async function capture(page: Page, name: string) {
  if (!process.env.STUDIO_SCREENSHOT_DIR) return;
  await mkdir(process.env.STUDIO_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(process.env.STUDIO_SCREENSHOT_DIR, name + '.png'), animations: 'disabled' });
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1); }

for (const viewport of [{ width: 1728, height: 1117 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`client Studio tabs and default comparison fit ${viewport.width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport); const state = await install(page, baseURL);
    await page.goto('/listing-studio');
    await expect(page.getByRole('tab', { name: 'Studio', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: /Hey Shubham/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true);
    const photos = page.getByRole('region', { name: 'Available photo edits' }).locator('img');
    await expect(photos).toHaveCount(4);
    for (const image of await photos.all()) expect(await image.evaluate((n: HTMLImageElement) => n.complete && n.naturalWidth > 0)).toBe(true);
    if (viewport.width >= 1440) expect(await page.getByRole('region', { name: 'Start a photo edit' }).evaluate(n => n.getBoundingClientRect().width / n.closest('main')!.clientWidth)).toBeGreaterThan(0.9);
    await noOverflow(page); await capture(page, `studio-${viewport.width}`);
    await page.getByRole('tab', { name: 'Credits and plans' }).click(); await expect(page.getByRole('heading', { name: 'Credits and plans', exact: true })).toBeVisible(); await noOverflow(page); await capture(page, `billing-${viewport.width}`);
    await page.getByRole('tab', { name: 'My edits' }).click(); await expect(page.getByRole('heading', { name: 'My edits', exact: true })).toBeVisible(); await noOverflow(page);
    await page.getByRole('button', { name: /Green grass.*1 photo/ }).click();
    const controls = page.getByRole('group', { name: 'Photo view' });
    await expect(controls.getByRole('button').first()).toHaveText('Compare'); await expect(controls.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const slider = page.getByTestId('before-after-control'); await expect(slider).toBeVisible(); await slider.focus(); await slider.press('End'); await expect(slider).toHaveValue('100');
    await controls.getByRole('button', { name: 'Before', exact: true }).click(); await expect(slider).toHaveCount(0);
    await controls.getByRole('button', { name: 'Compare', exact: true }).click(); await expect(slider).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('before-after-control')).toHaveValue('50');
    await expect.poll(() => page.locator('.v4-photo-image-frame > img').evaluate((n: HTMLImageElement) => n.naturalWidth > 1 && n.getBoundingClientRect().height > 120 && n.getBoundingClientRect().width > 200)).toBe(true);
    await noOverflow(page); await capture(page, `result-${viewport.width}`);
    expect(state.requests.filter(r => r.method !== 'GET')).toEqual([]);
  });
}

test('a local photo is reviewed without spending credit and duplicate revision recovery keeps its key', async ({ page, baseURL }) => {
  const state = await install(page, baseURL); await page.goto('/listing-studio');
  await page.getByLabel('Upload your listing photo').setInputFiles(resolve('public/studio-assets/listing-studio/staging.png'));
  await expect(page.getByRole('heading', { name: 'Review your edit' })).toBeVisible();
  await expect(page.getByLabel('Room', { exact: true })).toHaveValue('living');
  await page.getByRole('button', { name: 'Review price', exact: true }).first().click();
  await expect(page.getByRole('radio', { name: /Editing credit/ })).toBeChecked();
  expect(state.requests.filter(r => r.path === 'client/orders' && r.method === 'POST')).toHaveLength(0);
  await page.goto(`/listing-studio?tab=photos&order=${state.order.id}`);
  await page.getByRole('textbox', { name: 'What would you like to change?' }).fill('Use a lighter rug.'); state.failNextRevision();
  await page.getByRole('button', { name: 'Request AI revision · 3 remaining' }).click(); await expect(page.getByRole('button', { name: 'Check existing revision' })).toBeVisible();
  await page.getByRole('button', { name: 'Check existing revision' }).click(); await expect(page.getByText('1 of 3 used')).toBeVisible();
  const revisions = state.requests.filter(r => r.path.endsWith('/ai-revisions'));
  expect(revisions).toHaveLength(2); expect(revisions[0].key).toBeTruthy(); expect(revisions[1].key).toBe(revisions[0].key);
  expect(state.requests.some(r => /checkout|subscription|billing-portal/.test(r.path))).toBe(false);
});

test('all three plans can be reviewed without starting checkout', async ({ page, baseURL }) => {
  const state = await install(page, baseURL); state.account.subscription = null; state.account.capabilities.canSubscribe = true;
  await page.goto('/listing-studio?tab=billing');
  await expect(page.getByText('No active subscription', { exact: true })).toBeVisible();
  for (const name of ['Starter', 'Pro', 'Studio']) {
    await page.getByRole('button', { name: `Choose ${name}`, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(`Review your ${name} plan`);
    await expect(page.getByRole('button', { name: 'Continue to secure checkout' })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
});

test('three used AI revisions disable new requests and preserve previous versions', async ({ page, baseURL }) => {
  const state = await install(page, baseURL);
  state.order.aiRevisions = { ...state.order.aiRevisions!, used: 3, remaining: 0, canRequest: false,
    versions: [{ id: 'initial', number: 0, createdAt: null }, ...[1, 2, 3].map(number => ({ id: `00000000-0000-4000-8000-00000000001${number}`, number, createdAt: null }))] };
  await page.goto(`/listing-studio?tab=photos&order=${state.order.id}`);
  await expect(page.getByText('3 of 3 used')).toBeVisible();
  await expect(page.getByText('All three included revisions have been used.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Request AI revision/ })).toHaveCount(0);
  const preview = page.waitForRequest(request => request.url().includes('/preview?') && new URL(request.url()).searchParams.get('version') === 'initial');
  await page.getByLabel('Saved version', { exact: true }).selectOption('initial'); await preview;
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
});
