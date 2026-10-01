import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';

const output = process.env.ROBBIE_REVIEW_OUTPUT || path.resolve('..', 'output', 'calls-support-redesign', 'robbie-qa');
const existingMessage = { id: 'earlier-answer', sender: 'assistant', content: 'Your earlier conversation remains here.', createdAt: '2026-09-30T10:00:00Z' };
const existingSession = { id: 'existing-chat', title: 'Existing shoot conversation', topic: 'general', messageCount: 1, createdAt: '2026-09-30T10:00:00Z', updatedAt: '2026-09-30T10:00:00Z' };
const guide = { id: 'upload-photos', title: 'Upload shoot photos', summary: 'Send photos from your assigned shoot and resolve common upload problems.', category: 'Uploads', roles: ['photographer', 'admin', 'salesRep'], steps: ['Open your assigned shoot from Shoot history.', 'Open Media and choose Upload raw files.', 'Choose the files, wait for every upload result, then review any failed filenames before retrying.'], troubleshooting: ['Keep the dashboard open until the upload finishes.', 'Retry only failed files. Successful files remain attached to the shoot.'], escalation: 'Send the team the shoot ID, filenames that failed, and the error message. Never send passwords or payment card details.', links: [{ label: 'Open shoot history', url: '/shoot-history' }], updated_at: '2026-09-30' };

async function fixture(page: Page, baseURL: string | undefined, role: string, theme: string) {
  if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) throw new Error('Support fixtures are local only.');
  const requests: Array<{ path: string; body: Record<string, unknown> | null }> = [];
  const user = { id: '900043', name: 'Taylor Morgan', email: 'taylor@example.test', role, account_status: 'active', email_verified_at: '2026-01-01T00:00:00Z', metadata: { terms_accepted_at: '2026-01-01T00:00:00Z' } };
  await page.addInitScript(({ user, theme }) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('theme', theme); localStorage.setItem('authToken', 'local-robbie-support-fixture'); localStorage.setItem('user', JSON.stringify(user));
  }, { user, theme });
  const reply = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api/, '');
    requests.push({ path: pathname, body: request.postData() ? request.postDataJSON() : null });
    if (pathname === '/user') return reply(route, user);
    if (pathname === '/me/permissions') return reply(route, { permissions: ['dashboard', 'shoot-history', 'robbie'].map(resource => ({ resource, action: 'view' })), permissionIds: ['robbie:view'] });
    if (pathname === '/ai/knowledge') {
      const pageNumber = Number(url.searchParams.get('page') || '1');
      const rows = pageNumber === 1 ? [guide, ...Array.from({ length: 11 }, (_, index) => ({ ...guide, id: `guide-${index}`, title: `Dashboard guide ${index + 1}` }))] : [{ ...guide, id: 'last-guide', title: 'Last guide on page two' }];
      return reply(route, { data: rows, meta: { role, total: 13, categories: ['Uploads'], pagination: { current_page: pageNumber, per_page: 12, total: 13, last_page: 2 } } });
    }
    if (pathname === '/ai/knowledge/upload-photos') return reply(route, { data: guide, meta: { role } });
    if (pathname === '/ai/sessions') return reply(route, { data: [existingSession], meta: { stats: { thisWeekCount: 0, avgMessagesPerSession: 0, topTopic: 'general' } } });
    if (pathname === '/ai/sessions/existing-chat') return reply(route, { session: existingSession, messages: [existingMessage] });
    if (pathname === '/ai/chat') {
      const body = request.postDataJSON();
      return reply(route, { sessionId: body.sessionId || 'support-fixture', messages: [existingMessage, { id: 'user-1', sender: 'user', content: body.message, createdAt: new Date().toISOString() }, { id: 'assistant-1', sender: 'assistant', content: 'Open your assigned shoot, then choose Media and Upload raw files. Retry only failed files.', metadata: { knowledge_articles: [{ id: guide.id, title: guide.title }] }, createdAt: new Date().toISOString() }], meta: { suggestions: ['View help guides', 'How do I report an upload issue?'] } });
    }
    if (pathname === '/notifications') return reply(route, { data: { activity_log: [], unread_count: 0 } });
    if (pathname === '/voice/browser/config') return reply(route, { enabled: false, ready: false, blockers: [] });
    if (pathname === '/weather') return reply(route, { data: { temperature: '72°F', icon: 'sunny', description: 'Clear', location: 'Austin' } });
    return reply(route, { success: true, data: [], notifications: [], unread_count: 0 });
  });
  return requests;
}

for (const scenario of [
  { role: 'admin', width: 1440, height: 1000, theme: 'light' },
  { role: 'admin', width: 1440, height: 1000, theme: 'dark' },
  { role: 'photographer', width: 390, height: 844, theme: 'light' },
  { role: 'photographer', width: 390, height: 844, theme: 'dark' },
  { role: 'salesRep', width: 390, height: 844, theme: 'light' },
]) {
  test(`${scenario.role} keeps the same chat and draft while using guides at ${scenario.width}px ${scenario.theme}`, async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(scenario);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = await fixture(page, baseURL, scenario.role, scenario.theme);
    await page.goto('/chat-with-reproai');
    await expect(page.getByRole('button', { name: /Existing shoot conversation/ })).toBeVisible({ timeout: 60_000 });
    if (scenario.role !== 'admin') await expect(page.getByText('Book a New Shoot', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /Existing shoot conversation/ }).click();
    await expect(page.getByText(existingMessage.content, { exact: true })).toBeVisible();
    const composer = page.locator('textarea[aria-label="Message Robbie"]');
    const draft = 'My existing draft about the failed second file.';
    await composer.fill(draft);
    await expect(page.getByRole('button', { name: 'Help & guides', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Help & guides', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Help & guides', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Help & guides' })).toHaveCount(0);
    await expect(composer).toHaveValue(draft);
    if (scenario.width >= 1280) {
      await expect(composer).toBeVisible();
      await expect(page.getByRole('tab', { name: 'History', exact: true })).toBeVisible();
      await expect(page.getByText(existingMessage.content, { exact: true })).toBeVisible();
      const pane = await page.getByRole('complementary', { name: 'Help & guides' }).boundingBox();
      const input = await composer.boundingBox();
      expect(pane?.width).toBe(380);
      expect((input?.x || 0) + (input?.width || 0)).toBeLessThan(pane?.x || 0);
    } else await expect(page.getByRole('dialog', { name: 'Help & guides' })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('link', { name: /Last guide on page two/ })).toBeVisible();
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    const prefix = `${scenario.role}-${scenario.width}-${scenario.theme}`;
    await page.screenshot({ path: path.join(output, `${prefix}-guides.png`), fullPage: true });
    await page.getByRole('link', { name: /Uploads Upload shoot photos/ }).click();
    await expect(page.getByRole('article').getByRole('heading', { name: 'Upload shoot photos', exact: true })).toBeVisible();
    await expect(page.getByText('Open Media and choose Upload raw files.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(output, `${prefix}-article.png`), fullPage: true });
    await page.getByRole('button', { name: 'Ask Robbie about this' }).click();
    await expect(page.getByRole('heading', { name: 'Help & guides', exact: true })).toHaveCount(0);
    await expect(composer).toHaveValue(`${draft}\n\nHelp me with: Upload shoot photos`);
    await expect(composer).toBeFocused();
    await expect.poll(() => composer.evaluate((node: HTMLTextAreaElement) => node.selectionEnd)).toBe(`${draft}\n\nHelp me with: Upload shoot photos`.length);
    expect(requests.filter(request => request.path === '/ai/chat')).toHaveLength(0);
    await expect(page.getByText(existingMessage.content, { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, `${prefix}-prepared-draft.png`), fullPage: true });
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Guides used in this answer' })).toBeVisible();
    const chat = requests.find(request => request.path === '/ai/chat');
    expect(chat?.body?.sessionId).toBe('existing-chat');
    expect(chat?.body?.message).toBe(`${draft}\n\nHelp me with: Upload shoot photos`);
    expect(chat?.body?.context).toMatchObject({ intent: 'support_faq', knowledge_article_id: 'upload-photos' });
    await composer.fill('Another unsent draft');
    await page.getByRole('navigation', { name: 'Guides used in this answer' }).getByRole('link', { name: 'Upload shoot photos' }).click();
    await expect(page.getByRole('article').getByRole('heading', { name: 'Upload shoot photos', exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Help & guides', exact: true })).toHaveCount(0);
    await expect(composer).toHaveValue('Another unsent draft');
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Help & guides', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close help guides' }).click();
    await expect(composer).toHaveValue('Another unsent draft');
    await page.getByRole('button', { name: 'View help guides', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Help & guides', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close help guides' }).click();
    await page.getByRole('tab', { name: 'History', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Chat History' })).toBeVisible();
    await page.getByRole('button', { name: 'Help & guides', exact: true }).click();
    await page.getByRole('button', { name: 'Close help guides' }).click();
    await expect(page.getByRole('heading', { name: 'Chat History' })).toBeVisible();
    await page.getByRole('tab', { name: 'Home', exact: true }).click();
    await expect(composer).toHaveValue('Another unsent draft');
    await expect(page.getByText(existingMessage.content, { exact: true })).toBeVisible();
    expect(requests.filter(request => request.path === '/ai/chat')).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}
