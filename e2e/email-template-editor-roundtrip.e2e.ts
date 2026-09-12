import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/auth';
import type { MessageTemplate } from '../src/types/messaging';

async function loginForTemplateEditor(page: Page) {
  const permissionsReady = page.waitForResponse((response) =>
    response.url().endsWith('/api/me/permissions') && response.ok(),
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Email').fill(ADMIN_EMAIL);
  await page.getByPlaceholder('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await permissionsReady;
}

test('custom email content saves, reopens, and previews unsaved edits in both themes', async ({ page }, testInfo) => {
  await loginForTemplateEditor(page);
  const templatesReady = page.waitForResponse((response) =>
    /\/messaging\/templates\?/.test(response.url()) && response.request().method() === 'GET',
  );
  const navigationStartedAt = Date.now();
  await page.goto('/messaging/email/templates');
  const templatesResponse = await templatesReady;
  expect(templatesResponse.ok()).toBeTruthy();
  await testInfo.attach('template-list-timing', {
    body: JSON.stringify({ elapsedMs: Date.now() - navigationStartedAt, status: templatesResponse.status() }),
    contentType: 'application/json',
  });
  await expect(page.getByRole('heading', { name: 'Email Templates', exact: true })).toBeVisible();
  const name = `Email atelier QA ${Date.now()}`;
  let created = false;
  try {
    await page.getByRole('button', { name: 'New template', exact: true }).click();
    await page.getByLabel('Template Name *').fill(name);
    await page.getByLabel('Email Subject *').fill('QA: hello {{client_first_name}}');
    await page.getByLabel('Email HTML content').fill('<h2>Roundtrip content</h2><p>Hello {{client_first_name}}</p>');
    await page.getByRole('tab', { name: 'Text', exact: true }).click();
    await page.getByLabel('Email plain text content').fill('Roundtrip content. Hello {{client_first_name}}');
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Delivered email preview"]');
    await expect(frame.getByRole('heading', { name: 'Roundtrip content' })).toBeVisible();
    await expect(page.getByTitle('Delivered email preview')).toHaveAttribute('width', '720');
    await expect(frame.locator('body[data-email-design="atelier-v6"]')).toHaveCSS('background-color', 'rgb(237, 242, 247)');
    await expect(frame.locator('[data-email-content="true"]')).toHaveCount(1);
    await expect(frame.getByText(/^Hello \S+/)).toBeVisible();
    await expect.poll(() => frame.locator('img:visible').evaluateAll((images) =>
      images.length > 0 && images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
    )).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('email-editor-light-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await page.getByRole('button', { name: 'Mobile', exact: true }).click();
    await expect(page.getByTitle('Delivered email preview')).toHaveAttribute('width', '375');
    await expect(frame.getByRole('heading', { name: 'Roundtrip content' })).toBeVisible();
    await expect(frame.locator('body[data-email-design="atelier-v6"]')).toHaveCSS('background-color', 'rgb(8, 15, 23)');
    await expect(frame.locator('.email-container.content-card-bg')).toHaveCSS('background-color', 'rgb(18, 30, 44)');
    await expect.poll(() => frame.locator('img:visible').evaluateAll((images) =>
      images.length > 0 && images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0),
    )).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('email-editor-dark-mobile.png'), fullPage: true });

    const savedResponse = page.waitForResponse((response) =>
      /\/messaging\/templates$/.test(response.url()) && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = await savedResponse;
    expect(saved.ok()).toBeTruthy();
    created = true;
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByPlaceholder('Search templates...').fill(name);
    await page.getByRole('heading', { name, exact: true }).click();
    await expect(page.getByLabel('Email HTML content')).toHaveValue('<h2>Roundtrip content</h2><p>Hello {{client_first_name}}</p>');
    await page.getByRole('tab', { name: 'Text', exact: true }).click();
    await expect(page.getByLabel('Email plain text content')).toHaveValue('Roundtrip content. Hello {{client_first_name}}');
    await page.getByRole('tab', { name: 'HTML', exact: true }).click();
    await page.getByLabel('Email HTML content').fill('<h2>Unsaved preview change</h2><p>Hello {{client_first_name}}</p>');
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    await expect(frame.getByRole('heading', { name: 'Unsaved preview change' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).click();
    await expect(page.getByLabel('Email HTML content')).toHaveValue('<h2>Roundtrip content</h2><p>Hello {{client_first_name}}</p>');
  } finally {
    if (created) {
      await page.goto('/messaging/email/templates');
      await page.getByPlaceholder('Search templates...').fill(name);
      await page.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await expect(page.getByRole('heading', { name, exact: true })).not.toBeVisible();
    }
  }
});

test('protected email edits persist and reopen with the override enabled', async ({ page }) => {
  await loginForTemplateEditor(page);
  const listResponse = page.waitForResponse((response) =>
    /\/messaging\/templates\?/.test(response.url()) && response.request().method() === 'GET',
  );
  await page.goto('/messaging/email/templates');
  const templates: MessageTemplate[] = await (await listResponse).json();
  const original = templates.find((template) => template.slug === 'account-created');
  expect(original, 'Seeded account-created template is required').toBeTruthy();
  if (!original) return;
  const originalHtml = original.editable_body_html ?? original.body_html ?? '';
  let edited = false;
  try {
    await page.getByPlaceholder('Search templates...').fill(original.name);
    await page.getByRole('heading', { name: original.name, exact: true }).click();
    await page.getByLabel('Email Subject *').fill('QA account {{client_first_name}}');
    await page.getByLabel('Email HTML content').fill(`${originalHtml}\n<p>Protected email roundtrip check.</p>`);
    await page.getByRole('checkbox', { name: 'Use the saved subject and body for this automated email' }).check();
    const savedResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/messaging/templates/${original.id}`) && response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const response = await savedResponse;
    expect(response.ok()).toBeTruthy();
    edited = true;
    const saved: MessageTemplate = await response.json();
    expect(saved.email_type).toBe('ACCOUNT_CREATED');
    expect(saved.override_enabled).toBe(true);
    expect(saved.body_html).not.toMatch(/<!doctype|<html[\s>]/i);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('heading', { name: original.name, exact: true }).click();
    await expect(page.getByLabel('Email Subject *')).toHaveValue('QA account {{client_first_name}}');
    await expect(page.getByLabel('Email HTML content')).toHaveValue(saved.editable_body_html ?? saved.body_html ?? '');
    await expect(page.getByRole('checkbox', { name: 'Use the saved subject and body for this automated email' })).toBeChecked();
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    await expect(page.frameLocator('iframe[title="Delivered email preview"]').getByText('Protected email roundtrip check.', { exact: true })).toBeVisible();
  } finally {
    if (edited) {
      await page.goto('/messaging/email/templates');
      await page.getByPlaceholder('Search templates...').fill(original.name);
      await page.getByRole('heading', { name: original.name, exact: true }).click();
      await page.getByLabel('Email Subject *').fill(original.subject ?? '');
      await page.getByLabel('Email HTML content').fill(originalHtml);
      await page.getByRole('checkbox', { name: 'Use the saved subject and body for this automated email' }).setChecked(original.override_enabled ?? false);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  }
});

test('live report blocks can be reinserted, saved, reopened, and rendered with sample rows', async ({ page }) => {
  await loginForTemplateEditor(page);
  const listResponse = page.waitForResponse((response) =>
    /\/messaging\/templates\?/.test(response.url()) && response.request().method() === 'GET',
  );
  await page.goto('/messaging/email/templates');
  const templates: MessageTemplate[] = await (await listResponse).json();
  const original = templates.find((template) => template.slug === 'payout-report');
  expect(original, 'Seeded payout-report template is required').toBeTruthy();
  if (!original) return;
  const originalHtml = original.editable_body_html ?? original.body_html ?? '';
  let edited = false;
  try {
    await page.getByPlaceholder('Search templates...').fill(original.name);
    await page.getByRole('heading', { name: original.name, exact: true }).click();
    await expect(page.getByText('Live email content', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Included: payout report', exact: true })).toBeDisabled();
    await expect(page.getByText('Automated email override', { exact: true })).not.toBeVisible();
    await page.getByLabel('Email HTML content').fill('<p>Report introduction edited in the browser.</p>');
    await page.getByRole('button', { name: 'Insert: payout report', exact: true }).click();
    const savedResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/messaging/templates/${original.id}`) && response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const response = await savedResponse;
    expect(response.ok()).toBeTruthy();
    edited = true;
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('heading', { name: original.name, exact: true }).click();
    await expect(page.getByLabel('Email HTML content')).toHaveValue(/\{\{payout_report_html\}\}/);
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Delivered email preview"]');
    await expect(frame.getByText('Report introduction edited in the browser.', { exact: true })).toBeVisible();
    await expect(frame.getByText('Preview example', { exact: true })).toBeVisible();
  } finally {
    if (edited) {
      await page.goto('/messaging/email/templates');
      await page.getByPlaceholder('Search templates...').fill(original.name);
      await page.getByRole('heading', { name: original.name, exact: true }).click();
      await page.getByLabel('Email HTML content').fill(originalHtml);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  }
});
