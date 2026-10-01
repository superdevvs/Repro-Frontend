import { expect as baseExpect, test, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const output = process.env.SUPPORT_REVIEW_OUTPUT || path.resolve('..', 'output', 'calls-support-implementation');
const accountFile = process.env.SUPPORT_QA_ACCOUNTS || path.join(output, 'runtime-accounts.json');
type Account = { id: number; user: Record<string, unknown>; token: string };
const api = process.env.SUPPORT_QA_API || 'http://127.0.0.1:8035';
const expect = baseExpect.configure({ timeout: 30000 });
const closing = new WeakSet<Page>();
test.use({ actionTimeout: 30000 });
test.setTimeout(300000);

async function login(page: Page, context: BrowserContext, role: string, baseURL: string | undefined, theme = 'light') {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname) || new URL(api).hostname !== '127.0.0.1') throw new Error('Real API fixture requires localhost.');
  const accounts = JSON.parse(fs.readFileSync(accountFile, 'utf8')) as Record<string, Account>;
  const account = accounts[role];
  await context.addInitScript(({ account, theme }) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('theme', theme); localStorage.setItem('authToken', account.token); localStorage.setItem('user', JSON.stringify(account.user));
  }, { account, theme });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');
    if (pathname.startsWith('/support/tickets') || pathname.startsWith('/ai/knowledge') || pathname.startsWith('/ai/sessions') || ['/ai/chat', '/user', '/me/permissions', '/notifications'].includes(pathname)) {
      // Real Laravel auth, controllers, services and isolated SQLite; no fixture responses for the feature under test.
      try {
        const response = await route.fetch({ url: api + url.pathname + url.search, headers: { ...request.headers(), authorization: `Bearer ${account.token}` }, timeout: 60000 });
        return await route.fulfill({ response });
      } catch {
        if (closing.has(page) || page.isClosed() || request.failure()?.errorText.includes('ERR_ABORTED')) return;
        throw new Error(`Isolated support API failed: ${request.method()} ${pathname}`);
      }
    }
    const data = pathname === '/voice/browser/config' ? { enabled: false, ready: false, blockers: [] }
      : pathname === '/voice/push/settings' ? { data: { enabled: false, configured: false } }
        : { data: [], notifications: [], success: true };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return account;
}

test('real support API: phone client submits, admin triages, private note stays private, reply reopens and paginates', async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  test.skip(!fs.existsSync(accountFile), 'Start the isolated Laravel SupportHttpFixture first.');
  const clientContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const client = await clientContext.newPage();
  const admin = await adminContext.newPage();
  const errors: string[] = [];
  client.on('pageerror', e => errors.push(e.message)); admin.on('pageerror', e => errors.push(e.message));
  await login(client, clientContext, 'client', baseURL);
  await login(admin, adminContext, 'admin', baseURL, 'dark');
  const subject = `Download recovery ${Date.now()}`;
  await client.goto(`${baseURL}/support`);
  await expect(client.getByRole('heading', { name: 'Your support requests' })).toBeVisible({ timeout: 60000 });
  await expect(client).toHaveURL(/\/messaging\/email\/inbox\?tab=support$/);
  await expect(client.getByRole('navigation', { name: 'Messaging navigation' }).getByRole('link', { name: 'Support', exact: true })).toHaveAttribute('aria-current', 'page');
  await client.getByRole('navigation', { name: 'Support request pages' }).getByRole('button', { name: 'Next' }).click();
  await expect(client.getByRole('navigation', { name: 'Support request pages' })).toContainText('2 /');
  await client.getByRole('button', { name: 'New request', exact: true }).click();
  await client.getByLabel('Request subject').fill(subject);
  await client.getByLabel('Request topic').selectOption('delivery');
  await client.getByLabel('Request details').fill('I tried downloading a delivered gallery and saw a connection error.');
  await client.getByRole('button', { name: 'Submit request' }).click();
  await expect(client.getByRole('heading', { name: subject, exact: true })).toBeVisible();
  const ticketId = new URL(client.url()).searchParams.get('ticket');
  expect(Number(ticketId)).toBeGreaterThan(0);
  await admin.goto(`${baseURL}/messaging/email/inbox?tab=support&ticket=${ticketId}`);
  await expect(admin.getByRole('heading', { name: 'Support inbox' })).toBeVisible();
  await admin.getByLabel('Request status', { exact: true }).selectOption('in_progress');
  await expect(admin.getByLabel('Request status', { exact: true })).toHaveValue('in_progress');
  await admin.getByLabel('Assigned administrator').selectOption({ label: 'QA Admin' });
  await expect(admin.getByRole('region', { name: 'Support conversation' })).toContainText('With QA Admin');
  await admin.getByLabel('Internal note · admins only').check();
  await admin.getByLabel('Internal note', { exact: true }).fill('Private diagnosis: investigation only.');
  await admin.getByRole('button', { name: 'Save internal note' }).click();
  await expect(admin.getByText('Private diagnosis: investigation only.')).toBeVisible();
  await admin.getByLabel('Internal note · admins only').uncheck();
  await admin.getByLabel('Reply', { exact: true }).fill('Please open Download Center and retry the full-resolution archive.');
  await admin.getByRole('button', { name: 'Send reply' }).click();
  await expect(admin.getByText('Please open Download Center and retry the full-resolution archive.')).toBeVisible();
  await admin.getByLabel('Request status', { exact: true }).selectOption('resolved');
  await expect(admin.getByLabel('Request status', { exact: true })).toHaveValue('resolved');
  await client.reload();
  await expect(client.getByText('Please open Download Center and retry the full-resolution archive.')).toBeVisible();
  await expect(client.getByText('Private diagnosis: investigation only.')).toHaveCount(0);
  await expect(client.getByRole('button', { name: 'Mark resolved' })).toHaveCount(0);
  await client.getByLabel('Reply', { exact: true }).fill('The archive still stops halfway through. Please keep this open.');
  await client.getByRole('button', { name: 'Send reply' }).click();
  await expect(client.getByRole('button', { name: 'Mark resolved' })).toBeVisible();
  await expect(client.getByRole('button', { name: 'Saving…' })).toHaveCount(0);
  await client.getByRole('heading', { name: subject, exact: true }).scrollIntoViewIfNeeded();
  await client.screenshot({ path: path.join(output, 'support-client-phone.png'), fullPage: true });
  await admin.reload();
  await expect(admin.getByLabel('Request status', { exact: true })).toHaveValue('open');
  await admin.screenshot({ path: path.join(output, 'support-admin-desktop-dark.png'), fullPage: true });
  for (const page of [client, admin]) expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  closing.add(client); closing.add(admin);
  await clientContext.close(); await adminContext.close();
});

for (const scenario of [
  { role: 'client', article: 'media-download', title: 'Download photos, videos and floorplans' },
  { role: 'photographer', article: 'photographer-upload', title: 'Upload shoot files and recover failed files' },
  { role: 'salesRep', article: 'rep-sales', title: 'Review client invoices and commission' },
]) {
  test(`real Robbie API: ${scenario.role} reads their guide and asks the same question in chat`, async ({ page, context, baseURL }) => {
    test.skip(!fs.existsSync(accountFile), 'Start the isolated Laravel SupportHttpFixture first.');
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, context, scenario.role, baseURL);
    await page.goto(`${baseURL}/chat-with-reproai?tab=help&article=${scenario.article}`);
    await expect(page.getByRole('article').getByRole('heading', { name: scenario.title, exact: true })).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Ask Robbie about this' }).click();
    await expect(page.getByRole('textbox', { name: 'Message Robbie' })).toHaveValue(`Help me with: ${scenario.title}`);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Guides used in this answer' }).getByRole('link', { name: scenario.title })).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole('link', { name: 'Read this guide', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(output, `robbie-real-${scenario.role}-phone.png`), fullPage: true });
    closing.add(page);
  });
}
