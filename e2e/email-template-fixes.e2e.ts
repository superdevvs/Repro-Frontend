import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { emailWorkspaceFixture } from './helpers/emailWorkspaceFixture';

test('connected system copy remains editable and keeps its runtime wrapper', async ({ page }) => {
  const fixture = await emailWorkspaceFixture(page);
  await loginAsAdmin(page); await page.goto('/messaging/email/templates');
  await page.getByRole('heading', { name: 'Connected account welcome', exact: true }).click();
  await expect(page.getByLabel('Email subject', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Edit Introduction', exact: true }).click();
  await page.getByLabel('Section content').fill('A warm welcome, {{client_name}}.');
  await page.getByRole('button', { name: 'Close section editor' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  expect(fixture.templates[1].body_html).toBe('{{system_body_html}}');
  expect(fixture.templates[1].content_blocks_json?.['account.intro'].body_text).toBe('A warm welcome, {{client_name}}.');
  await page.getByRole('button', { name: 'Template settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Use this saved content for the automated email' })).toBeChecked();
  expect(fixture.sends).toBe(0);
});
