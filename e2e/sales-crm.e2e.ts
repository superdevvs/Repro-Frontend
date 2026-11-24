import { expect, test, type Page } from '@playwright/test';

const adminToken = process.env.E2E_CRM_ADMIN_TOKEN;
const repToken = process.env.E2E_CRM_REP_TOKEN;
const apiKey = process.env.E2E_CRM_WEBSITE_KEY;
const isolated = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(process.env.E2E_BASE_URL ?? '');

test.skip(!isolated || !adminToken || !repToken, 'CRM acceptance requires a seeded local app and admin and rep fixture tokens.');

async function signIn(page: Page, token: string) {
  const response = await page.request.get('/api/user', { headers: { Authorization: `Bearer ${token}` } });
  expect(response.ok()).toBe(true);
  const data = await response.json();
  await page.addInitScript(({ token, user }) => {
    if (!localStorage.getItem('authToken')) {
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
  }, { token, user: data.user ?? data.data ?? data });
}

test('rep adds a contact, moves it, marks it lost and reopens it', async ({ page }) => {
  await signIn(page, repToken!);
  await page.goto('/crm');
  await expect(page.getByRole('heading', { name: 'My work today' })).toBeVisible();
  await page.goto('/crm/contacts');
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const name = `Browser fixture ${crypto.randomUUID().slice(0, 8)}`;
  await dialog.getByLabel('Full name').fill(name);
  await dialog.getByLabel('Segment').selectOption('residential');
  await dialog.getByRole('button', { name: 'Add contact', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  const stages = page.getByRole('list', { name: 'Sales stage' });
  await stages.getByRole('button', { name: 'Inquiry', exact: true }).click();
  await expect(stages.locator('[aria-current=step]')).toContainText('Inquiry');
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Mark lost' }).click();
  await dialog.getByLabel('Reason').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: 'Mark lost' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await dialog.getByLabel('Reopen into').selectOption('inquiry');
  await dialog.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(stages.locator('[aria-current=step]')).toContainText('Inquiry');
  await page.reload();
  await expect(stages.locator('[aria-current=step]')).toContainText('Inquiry');
});

test('recruiting intake replay is visible once after a refresh', async ({ page }) => {
  test.skip(!apiKey, 'The local website integration key is required.');
  await signIn(page, adminToken!);
  const reference = crypto.randomUUID();
  const applicant = `Browser Applicant ${reference.slice(0, 8)}`;
  const options = {
    headers: { 'X-API-Key': apiKey! },
    data: { name: applicant, email: `applicant-${reference}@example.com`, role: 'photographer', external_reference: reference },
  };
  const first = await page.request.post('/api/external/recruiting/application', options);
  expect(first.status()).toBe(201);
  const repeat = await page.request.post('/api/external/recruiting/application', options);
  expect(repeat.status()).toBe(201);
  expect((await first.json()).applicant_id).toBe((await repeat.json()).applicant_id);

  await page.goto('/crm/recruiting');
  await expect(page.getByText(applicant, { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(page.getByText(applicant, { exact: true })).toHaveCount(1);
});
