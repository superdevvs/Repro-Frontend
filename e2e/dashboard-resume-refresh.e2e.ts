import { expect, test, type Page } from '@playwright/test';
import { installShootDetailsWorkspaceFixture } from './helpers/shoot-details-workspace-fixture';

test.use({ timezoneId: 'Asia/Kolkata', video: 'off' });
const startTime = new Date('2026-10-21T03:00:00Z');
const afterIdle = new Date(startTime.getTime() + 31 * 60 * 1000);

async function setup(page: Page, baseURL: string | undefined, role: string) {
  await page.clock.setFixedTime(startTime);
  const fixture = await installShootDetailsWorkspaceFixture(page, baseURL, 'admin', 'light');
  await page.addInitScript(role => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.role = role; localStorage.setItem('user', JSON.stringify(user));
  }, role);
  await page.route('**/api/user', route => route.fulfill({ json: {
    id: 901, name: 'Resume Refresh QA', email: 'resume@example.test', role,
    account_status: 'active', email_verified_at: '2026-01-01', metadata: { terms_accepted_at: '2026-01-01' },
  } }));
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.goto('/shoot-history?view=grid');
  await expect(page.locator('main').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  return { fixture, documents: () => documents };
}

for (const width of [1440, 390]) for (const role of ['superadmin', 'admin', 'salesRep', 'editing_manager', 'editor', 'photographer', 'client']) {
  test(`${role} resumes after lid/screen inactivity at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const qa = await setup(page, baseURL, role);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.clock.setFixedTime(afterIdle);
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('pageshow')); });
    await expect.poll(qa.documents).toBe(2);
    await expect(page.locator('main').first()).toBeVisible();
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); });
    expect(qa.documents()).toBe(2);
    expect(page.url()).toContain('/shoot-history?view=grid');
    expect(qa.fixture.businessWrites).toEqual([]);
    expect(qa.fixture.pageErrors).toEqual([]);
  });
}

test('short absence and active use do not reload', async ({ page, baseURL }) => {
  const qa = await setup(page, baseURL, 'salesRep');
  for (let minutes = 10; minutes <= 60; minutes += 10) {
    await page.clock.setFixedTime(new Date(startTime.getTime() + minutes * 60 * 1000));
    await page.mouse.move(100 + minutes, 100);
  }
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(qa.documents()).toBe(1); expect(qa.fixture.businessWrites).toEqual([]);
});

test('an unsaved edit survives inactivity; explicit refresh can be cancelled', async ({ page, baseURL }) => {
  const qa = await setup(page, baseURL, 'salesRep');
  // A real browser input event exercises the global edit guard, independently
  // of whether a particular page uses a native <form> element.
  await page.evaluate(() => {
    const input = document.createElement('textarea'); input.setAttribute('aria-label', 'Unfinished QA note');
    document.querySelector('main')!.prepend(input);
  });
  await page.getByLabel('Unfinished QA note').fill('Keep this unfinished note');
  await page.clock.setFixedTime(afterIdle);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('status').filter({ hasText: 'A refresh is ready' })).toBeVisible();
  expect(qa.documents()).toBe(1);
  await expect(page.getByLabel('Unfinished QA note')).toHaveValue('Keep this unfinished note');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Refresh dashboard', exact: true }).click();
  expect(qa.documents()).toBe(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Refresh dashboard', exact: true }).click();
  await expect.poll(qa.documents).toBe(2);
  expect(qa.fixture.businessWrites).toEqual([]);
});

test('returning offline waits for the online event', async ({ page, baseURL, context }) => {
  const qa = await setup(page, baseURL, 'superadmin');
  await context.setOffline(true); await page.clock.setFixedTime(afterIdle);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('status').filter({ hasText: 'when you are online' })).toBeVisible();
  expect(qa.documents()).toBe(1);
  await context.setOffline(false); await expect.poll(qa.documents).toBe(2);
  expect(qa.fixture.businessWrites).toEqual([]);
});
