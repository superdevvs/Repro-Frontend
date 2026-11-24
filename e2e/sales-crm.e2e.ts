import { expect, test, type Page } from '@playwright/test';

const adminToken = process.env.E2E_CRM_ADMIN_TOKEN;
const repToken = process.env.E2E_CRM_REP_TOKEN;
const apiKey = process.env.E2E_CRM_WEBSITE_KEY;
const expectUi = expect.configure({ timeout: 30_000 });
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
  test.setTimeout(120_000);
  await signIn(page, repToken!);
  await page.goto('/crm');
  await expectUi(page.getByRole('heading', { name: 'My work today' })).toBeVisible();
  await page.goto('/crm/contacts');
  await page.getByRole('button', { name: 'Add contact', exact: true }).click({ timeout: 20_000 });
  const dialog = page.getByRole('dialog');
  const name = `Browser fixture ${crypto.randomUUID().slice(0, 8)}`;
  await dialog.getByLabel('Full name').fill(name);
  await dialog.getByLabel('Segment').selectOption('residential');
  await dialog.getByRole('button', { name: 'Add contact', exact: true }).click({ timeout: 20_000 });
  await expectUi(dialog).toBeHidden();
  await expectUi(page.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
  const stages = page.getByRole('list', { name: 'Sales stage' });
  await stages.getByRole('button', { name: /Inquiry$/ }).click({ timeout: 20_000 });
  await expectUi(stages.locator('[aria-current=step]')).toContainText('Inquiry');
  await page.getByRole('button', { name: 'More actions' }).click({ timeout: 20_000 });
  await page.getByRole('menuitem', { name: 'Mark lost' }).click({ timeout: 20_000 });
  await dialog.getByLabel('Reason').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: 'Mark lost' }).click({ timeout: 20_000 });
  await expectUi(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Reopen', exact: true }).click({ timeout: 20_000 });
  await dialog.getByLabel('Reopen into').selectOption('inquiry');
  await dialog.getByRole('button', { name: 'Reopen', exact: true }).click({ timeout: 20_000 });
  await expectUi(stages.locator('[aria-current=step]')).toContainText('Inquiry');
  await page.reload();
  await expectUi(stages.locator('[aria-current=step]')).toContainText('Inquiry');
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
  await expectUi(page.getByText(applicant, { exact: true })).toHaveCount(1);
  await page.reload();
  await expectUi(page.getByText(applicant, { exact: true })).toHaveCount(1);
});

test('changing an approved campaign returns it to review without delivering', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const repHeaders = { Authorization: `Bearer ${repToken}` };
  const templates = await page.request.get('/api/crm/templates?kind=campaign&approved_only=1', { headers: repHeaders });
  expect(templates.ok()).toBe(true);
  const [template] = (await templates.json()).data;
  expect(template?.id).toBeTruthy();
  const created = await page.request.post('/api/crm/campaigns', {
    headers: repHeaders,
    data: { name: `Browser campaign ${crypto.randomUUID().slice(0, 8)}`, template_id: template.id },
  });
  expect(created.status()).toBe(201);
  const { campaign } = await created.json();
  const route = `/crm/email/campaigns/${campaign.id}`;

  await signIn(page, repToken!);
  await page.goto(route);
  await page.getByRole('button', { name: 'Submit for review' }).click({ timeout: 25_000 });
  await expectUi(page.getByText('Waiting for review', { exact: true }).first()).toBeVisible();

  const supervisor = await browser.newPage({ baseURL: process.env.E2E_BASE_URL });
  try {
    await signIn(supervisor, adminToken!);
    await supervisor.goto(route);
    await supervisor.getByRole('button', { name: 'Approve', exact: true }).click({ timeout: 25_000 });
    await expectUi(supervisor.getByText(/^Approved by/)).toBeVisible();
  } finally {
    await supervisor.close();
  }

  await page.reload();
  await expectUi(page.getByText(/^Approved by/)).toBeVisible();
  await page.getByLabel('Subject').fill('Photos for upcoming listings');
  await expectUi(page.getByRole('button', { name: /^Send now to/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Save', exact: true }).click({ timeout: 25_000 });
  await expectUi(page.getByText('Waiting for review', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expectUi(page.getByLabel('Subject')).toHaveValue('Photos for upcoming listings');
  await expectUi(page.getByRole('button', { name: /^Send now to/ })).toHaveCount(0);
});
