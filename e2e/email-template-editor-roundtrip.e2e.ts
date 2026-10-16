import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { emailWorkspaceFixture } from './helpers/emailWorkspaceFixture';

for (const width of [360, 390, 768, 1280]) {
  test(`Robbie workspace manual editing and review at ${width}px`, async ({ page }) => {
    const fixture = await emailWorkspaceFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await loginAsAdmin(page);
    await page.goto('/messaging/email/templates');
    await page.getByRole('heading', { name: 'Photographer field notes', exact: true }).click();
    await expect(page.getByLabel('Email subject', { exact: true })).toBeVisible();
    await expect(page.getByText('EMAIL DETAILS', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Email studio', { exact: true })).toHaveCount(0);
    const workspace = page.getByRole('dialog', { name: 'Robbie email workspace', exact: true });
    await expect.poll(() => workspace.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect.poll(() => workspace.locator('.ews-toolbar').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Template actions', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Add section', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Edit Field notes', exact: true }).click();
    await page.getByLabel('Message', { exact: true }).fill('Pack your equipment. Check your batteries.');
    await page.getByRole('button', { name: 'Close section editor' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    expect(fixture.templates[0].editor_document_json?.sections[0].body).toBe('Pack your equipment. Check your batteries.');
    await page.getByRole('tab', { name: 'Preview', exact: true }).click();
    await expect(page.frameLocator('iframe[title="Delivered email preview"]').getByText('Pack your equipment. Check your batteries.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close editor', exact: true }).click();
    await page.getByRole('heading', { name: 'Photographer field notes', exact: true }).click();
    await expect(page.getByText('Pack your equipment. Check your batteries.', { exact: true })).toBeVisible();
    expect(fixture.sends).toBe(0);
  });
}

test('new HTML email retains its complete source through save and reopening', async ({ page }) => {
  const fixture = await emailWorkspaceFixture(page);
  await loginAsAdmin(page); await page.goto('/messaging/email/templates');
  await page.getByRole('button', { name: 'New template', exact: true }).click();
  await page.getByRole('button', { name: 'Paste or import HTML instead' }).click();
  const html = '<!doctype html><html><head><title>Client information</title><style>td{color:#14243a}</style></head><body><table><tr><td>New information for clients.</td></tr></table></body></html>';
  await page.getByLabel('Email HTML', { exact: true }).fill(html);
  await page.getByRole('button', { name: 'Use this HTML' }).click();
  await page.getByLabel('Email subject', { exact: true }).fill('Client information');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  expect(fixture.writes.at(-1)?.payload.body_html).toBe(html);
  await page.getByRole('button', { name: 'Close editor', exact: true }).click();
  await page.getByRole('heading', { name: 'Client information', exact: true }).click();
  await page.getByRole('tab', { name: 'HTML', exact: true }).click();
  await expect(page.getByLabel('Email HTML content')).toHaveValue(html);
  expect(fixture.sends).toBe(0);
});

test('Robbie suggestions require review and do not silently save or send', async ({ page }) => {
  const fixture = await emailWorkspaceFixture(page);
  await loginAsAdmin(page); await page.goto('/messaging/email/templates');
  await page.getByRole('heading', { name: 'Photographer field notes', exact: true }).click();
  await page.getByLabel('Ask Robbie', { exact: true }).fill('Make this email warmer.');
  await page.getByRole('button', { name: 'Ask Robbie ↑', exact: true }).click();
  await expect(page.getByText('Robbie’s suggestion', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.getByLabel('Email subject', { exact: true })).toHaveValue('Prepare for your next shoot');
  await page.getByRole('button', { name: 'Proposed', exact: true }).click();
  await expect(page.getByLabel('Email subject', { exact: true })).toHaveValue('A warmer subject from Robbie');
  expect(fixture.writes).toHaveLength(0); expect(fixture.sends).toBe(0);
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByLabel('Email subject', { exact: true })).toHaveValue('Prepare for your next shoot');
});
