import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installStudioFixtures } from './helpers/studio-v4-fixtures';
import fixtures from '../src/components/listing-studio/client/studioFixtures.test-data.json' with { type: 'json' };
import type { StudioClaimBilling } from '../src/services/listingStudioClaimBilling';

/** All API and Stripe traffic is intercepted. These fixtures must only run on loopback. */
async function install(page: Page, baseURL: string | undefined) {
  await installStudioFixtures(page, baseURL, [], 'client');
  const client = { id: '900042', name: 'Shubham soni', email: 'client@example.test', role: 'client', account_status: 'active',
    email_verified_at: null, email_verification: { required: true, verified: false }, metadata: { terms_accepted_at: '2026-01-01T00:00:00Z' } };
  await page.addInitScript(client => { localStorage.setItem('user', JSON.stringify(client)); localStorage.setItem('theme', 'dark'); }, client);
  await page.route('**/api/user', route => route.fulfill({ json: client }));
  const data: StudioClaimBilling = { account: { ...structuredClone(fixtures.account), subscription: null,
    credits: { ...fixtures.account.credits, availableCents: 0, reservedCents: 0, earnedCents: 0, usedCents: 0 },
    capabilities: { ...fixtures.account.capabilities, canSubscribe: true, canManageBilling: false } },
    catalog: structuredClone(fixtures.catalog), pendingCheckout: null, confirmationEmail: null };
  const requests: { path: string; method: string; key?: string; body: unknown }[] = [];
  const state = { data, requests, failSummary: false };
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Isolated Stripe checkout fixture</h1>' }));
  await page.route('https://billing.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Isolated billing portal fixture</h1>' }));
  await page.route('**/api/listing-studio/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname.replace('/api/listing-studio/', '');
    requests.push({ path, method: request.method(), key: request.headers()['idempotency-key'], body: request.postData() ? request.postDataJSON() : null });
    const reply = (value: unknown) => route.fulfill({ json: { success: true, data: value } });
    if (path === 'trials/billing') return state.failSummary ? route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } }) : reply(data);
    if (path === 'trials/billing/subscription-checkout') return reply({ url: 'https://checkout.stripe.com/c/pay/local_fixture' });
    if (path === 'trials/billing/portal') return reply({ url: 'https://billing.stripe.com/p/session/local_fixture' });
    if (path === 'trials' || path === 'trials/claim') return reply({ trials: [{ id: 'local-trial', service: 'decluttering', status: 'completed', progress: 100, previewAvailable: true, downloadAvailable: true, createdAt: '', completedAt: '', expiresAt: null, error: null, errorCode: null }] });
    return route.fulfill({ status: 501, json: { message: `Unmocked request ${path}` } });
  });
  return state;
}
async function capture(page: Page, name: string) {
  if (!process.env.STUDIO_SCREENSHOT_DIR) return;
  await mkdir(process.env.STUDIO_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(process.env.STUDIO_SCREENSHOT_DIR, name + '.png'), animations: 'disabled' });
}

for (const plan of ['Starter', 'Pro', 'Studio']) {
  test(`unverified claim client can go directly to isolated ${plan} Stripe checkout`, async ({ page, baseURL }) => {
    const state = await install(page, baseURL); await page.goto('/listing-studio/claim#' + 'b'.repeat(64));
    await expect(page.getByRole('button', { name: 'Download Digital decluttering' })).toBeEnabled();
    await expect(page).toHaveURL(/\/listing-studio\/claim$/);
    await page.getByRole('button', { name: 'View monthly plans', exact: true }).click();
    await expect(page.getByRole('button', { name: `Subscribe to ${plan}`, exact: true })).toBeInViewport();
    await page.getByRole('button', { name: `Subscribe to ${plan}`, exact: true }).click();
    await expect(page).toHaveURL('https://checkout.stripe.com/c/pay/local_fixture');
    await expect(page.getByRole('heading', { name: 'Isolated Stripe checkout fixture' })).toBeVisible();
    const checkouts = state.requests.filter(r => r.path.endsWith('/subscription-checkout'));
    expect(checkouts).toHaveLength(1); expect(checkouts[0].body).toEqual({ planCode: plan.toLowerCase() });
    expect(checkouts[0].key).toMatch(/^[0-9a-f-]{36}$/);
  });
}
for (const width of [1440, 390]) {
  test(`visible plans, recovery and authoritative subscription return at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1050 });
    const state = await install(page, baseURL); await page.goto('/listing-studio/claim?checkout=returned');
    await expect(page.getByText(/Checking your subscription\. Your plan/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Digital decluttering' })).toBeEnabled();
    expect(state.requests.filter(r => r.method === 'POST')).toEqual([]);
    await expect(page).toHaveURL(/\/listing-studio\/claim$/);
    await page.getByRole('button', { name: 'View monthly plans', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await capture(page, `claim-plans-${width}`);
    state.failSummary = true; await page.reload();
    await expect(page.getByRole('button', { name: 'Retry plans' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Digital decluttering' })).toBeEnabled();
    state.failSummary = false;
    state.data.account.subscription = { id: '8', planCode: 'pro', status: 'active', periodStart: '2026-11-05T00:00:00Z', periodEnd: '2026-12-05T00:00:00Z', cancelAtPeriodEnd: false };
    state.data.account.credits.availableCents = 13500; state.data.account.capabilities.canManageBilling = true;
    state.data.confirmationEmail = { status: 'sent', sentAt: '2026-11-05T00:00:00Z' };
    await page.getByRole('button', { name: 'Retry plans' }).click();
    await expect(page.getByText('Your Pro plan is ready')).toBeVisible();
    await expect(page.getByText('Your subscription confirmation email has been sent.')).toBeVisible();
    await page.getByRole('button', { name: 'View monthly plans', exact: true }).click();
    await capture(page, `claim-active-${width}`);
    await page.getByRole('button', { name: 'Manage subscription & invoices', exact: true }).click();
    await expect(page).toHaveURL('https://billing.stripe.com/p/session/local_fixture');
  });
}
