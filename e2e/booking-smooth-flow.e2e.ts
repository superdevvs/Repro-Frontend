import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Start e2e/fixtures/booking-harness.mjs and set E2E_BOOKING_FIXTURE=1.
// The fixture rejects saves and never contacts production.
test.skip(process.env.E2E_BOOKING_FIXTURE !== '1', 'Requires the local booking fixture');
const output = process.env.E2E_ARTIFACT_DIR || path.join(os.tmpdir(), 'repro-booking-qa');
fs.mkdirSync(output, { recursive: true });
test.use({ timezoneId: 'Asia/Kolkata' });
async function boot(page: Page, kind: string, role = 'admin', theme = 'dark') {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.goto(`/__qa?kind=${kind}&role=${role}&theme=${theme}`);
  await expect(page.getByRole('heading', { name: 'Book a new shoot', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Services & access', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible();
}
async function review(page: Page) {
  const confirm = page.getByRole('button', { name: 'CONFIRM', exact: true });
  // The roster request is asynchronous; wait for it to settle instead of
  // treating a provisional appointment as confirmed.
  await expect(page.getByText('Calculating distances...', { exact: true })).toHaveCount(0);
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Review & Confirm', exact: true })).toBeVisible();
}
async function typeTime(page: Page, trigger: ReturnType<Page['getByRole']>, time: string) {
  await trigger.click();
  await page.getByRole('button', { name: 'Type time', exact: true }).click();
  await page.getByRole('textbox', { name: 'Exact time', exact: true }).fill(time);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
}
for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
  for (const kind of ['photo', 'mixed', 'non-photo']) test(`${kind} scheduling and review at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await boot(page, kind, 'admin', viewport.width === 768 ? 'light' : 'dark');
    expect(await page.getByRole('heading', { name: 'Time', exact: true }).count()).toBe(0);
    await expect(page.getByRole('button', { name: 'Choose manually', exact: true })).toHaveCount(0);
    if (kind === 'non-photo') {
      await expect(page.getByRole('region', { name: 'Virtual staging schedule' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Photo editing schedule' })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const dateLabels = page.getByRole('button', { name: '20 Oct 2026', exact: true }).locator('span');
    expect(await dateLabels.evaluateAll(labels => labels.every(label => label.scrollWidth <= label.clientWidth))).toBe(true);
    await page.screenshot({ path: path.join(output, `${kind}-schedule-${viewport.width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'CONFIRM', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${kind}-schedule-controls-${viewport.width}.png`) });
    await review(page);
    if (kind !== 'non-photo') await expect(page.getByText('Jay Snap', { exact: true })).toBeVisible();
    if (kind === 'mixed') {
      await expect(page.getByText('KK - Kumnith Keo', { exact: true })).toBeVisible();
      await expect(page.getByText('2026-10-20 at 11:00 AM', { exact: true })).toBeVisible();
    }
    if (kind !== 'photo') await expect(page.getByText('2026-10-20 at 2:00 PM', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Property access' })).toContainText('Front door');
    await expect(page.getByRole('button', { name: 'Book Shoot', exact: true })).toBeEnabled();
    const settingsBeforeSubmit = await page.getByRole('region', { name: 'Payment and notifications' }).evaluate(element => {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent?.trim() === 'Book Shoot');
      return !!button && !!(element.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(settingsBeforeSubmit).toBe(true);
    await expect(page.getByText('Complete all steps to schedule your shoot', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Book Shoot', exact: true }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(output, `${kind}-review-${viewport.width}.png`), fullPage: true });
  });
}
test('removing the last photographer service keeps no-photographer schedules visible and editable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'mixed');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const remove = page.getByRole('button', { name: '\u00d7', exact: true });
  await remove.nth(2).click(); await remove.first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Virtual staging schedule' })).toBeVisible();
  await typeTime(page, page.getByRole('button', { name: '2:00 PM', exact: true }), '3:15 PM');
  await review(page); await expect(page.getByText('2026-10-20 at 3:15 PM', { exact: true })).toBeVisible();
});
test('a fresh draft can use service time and photographer controls without a hidden booking time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'fresh');
  await page.getByRole('button', { name: 'CONFIRM', exact: true }).click();
  await expect(page.getByText('Choose a time for HDR Photos', { exact: true })).toBeVisible();
  await typeTime(page, page.getByRole('button', { name: 'Select time', exact: true }), '9:30 AM');
  await page.getByRole('button', { name: 'Select a photographer', exact: true }).click();
  await page.getByRole('button', { name: /Jay Snap/ }).click();
  await expect(page.getByRole('button', { name: 'Confirm Assignment', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
  await review(page); await expect(page.getByText('2026-10-20 at 9:30 AM', { exact: true })).toBeVisible();
});
test('direct conflict editing checks the correct photographer and leaves existing bookings read only', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'conflict');
  await page.getByRole('button', { name: 'Adjust this day', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adjust this day', exact: true });
  await expect(dialog).toContainText('Jay Snap');
  await expect(dialog.getByRole('checkbox', { name: 'Allow changes to existing bookings' })).not.toBeChecked();
  await typeTime(page, dialog.getByRole('button', { name: '10:30 AM', exact: true }), '1:00 PM');
  await expect(dialog.getByRole('button', { name: 'Use this schedule', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Use this schedule', exact: true }).click();
  await review(page); await expect(page.getByText('2026-10-20 at 1:00 PM', { exact: true })).toBeVisible();
});
test('client review keeps request behavior and hides staff payment controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'mixed', 'client', 'light');
  await review(page); await expect(page.getByRole('button', { name: 'Request Shoot', exact: true })).toBeEnabled();
  await expect(page.getByRole('switch', { name: 'Bypass Payment', exact: true })).toHaveCount(0);
});
test('draft refresh preserves service times and separate notification recipients', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'mixed'); await review(page);
  await page.getByRole('checkbox', { name: 'Notify client', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Notify photographer', exact: true }).uncheck();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Book a new shoot', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await review(page); await expect(page.getByRole('checkbox', { name: 'Notify client', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Notify photographer', exact: true })).not.toBeChecked();
  await expect(page.getByText('2026-10-20 at 2:00 PM', { exact: true })).toBeVisible();
});
test('failed submission keeps the review and provides a retry with duplicate-click protection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'non-photo'); await review(page);
  let saves = 0;
  await page.route('**/api/shoots', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    saves++; await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ status: 503, json: { message: 'QA temporary failure' } });
  });
  await page.getByRole('button', { name: 'Book Shoot', exact: true }).dblclick();
  await expect(page.getByRole('alert')).toContainText('Your booking details have been kept'); expect(saves).toBe(1);
  await expect(page.getByText('2026-10-20 at 2:00 PM', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Book Shoot', exact: true }).click(); await expect.poll(() => saves).toBe(2);
});

test('mixed conflict adjustment preserves the other photographer and non-photo appointment', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'mixed-conflict');
  await page.getByRole('button', { name: 'Adjust this day', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adjust this day', exact: true });
  await expect(dialog).toContainText('Jay Snap');
  await typeTime(page, dialog.getByRole('button', { name: '10:30 AM', exact: true }), '1:00 PM');
  await dialog.getByRole('button', { name: 'Use this schedule', exact: true }).click();
  await review(page);
  await expect(page.getByText('2026-10-20 at 1:00 PM', { exact: true })).toBeVisible();
  await expect(page.getByText('2026-10-20 at 11:00 AM', { exact: true })).toBeVisible();
  await expect(page.getByText('2026-10-20 at 2:00 PM', { exact: true })).toBeVisible();
});

test('multi-unit review exposes each unit’s actual access, photographer and time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'multi'); await review(page);
  await page.getByRole('button', { name: 'View breakdown', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Unit booking breakdown', exact: true });
  const first = dialog.getByRole('region', { name: 'Unit 1 booking', exact: true });
  const second = dialog.getByRole('region', { name: 'Unit 2 booking', exact: true });
  await expect(first).toContainText('Jay Snap'); await expect(first).toContainText('9:00 AM');
  await expect(second).toContainText('KK - Kumnith Keo'); await expect(second).toContainText('1:00 PM');
  await expect(second).toContainText('QA lockbox');
  await page.screenshot({ path: path.join(output, 'multi-unit-review-mobile.png') });
});

test('client draft refresh retains appointments and never restores staff payment bypass', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'mixed', 'client'); await review(page);
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await review(page);
  await expect(page.getByText('2026-10-20 at 2:00 PM', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request Shoot', exact: true })).toBeEnabled();
  await expect(page.getByRole('switch', { name: 'Bypass Payment', exact: true })).toHaveCount(0);
});

test('sales rep can review mixed independent photographer assignments', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 }); await boot(page, 'mixed', 'salesRep'); await review(page);
  await expect(page.getByText('Jay Snap', { exact: true })).toBeVisible();
  await expect(page.getByText('KK - Kumnith Keo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book Shoot', exact: true })).toBeEnabled();
});

test('changing one photographer updates the visible row and preview without moving other times', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'mixed');
  const photos = page.getByRole('region', { name: 'HDR Photos schedule', exact: true });
  await photos.getByRole('button', { name: /Jay Snap/ }).click();
  await page.getByRole('button', { name: /KK - Kumnith Keo/ }).click();
  await page.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
  await expect(photos).toContainText('KK - Kumnith Keo');
  await expect(photos).toContainText('9:00 AM');
  await review(page);
  await expect(page.getByText('Jay Snap', { exact: true })).toHaveCount(0);
  await expect(page.getByText('2026-10-20 at 2:00 PM', { exact: true })).toBeVisible();
});

test('explicit apply-all copies times and leaves photographers independently assigned', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, 'mixed');
  await page.getByRole('region', { name: 'Virtual staging schedule', exact: true }).getByRole('button', { name: 'Apply this date and time to all services', exact: true }).click();
  await review(page);
  await expect(page.getByText('2026-10-20 at 2:00 PM', { exact: true })).toHaveCount(3);
  await expect(page.getByText('Jay Snap', { exact: true })).toBeVisible();
  await expect(page.getByText('KK - Kumnith Keo', { exact: true })).toBeVisible();
});

for (const kind of ['mixed', 'non-photo', 'multi']) test(`${kind} submitted payload matches the final review exactly`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await boot(page, kind); await review(page);
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/shoots', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 503, json: { message: 'QA save interception; no booking created.' } });
  });
  await page.getByRole('button', { name: 'Book Shoot', exact: true }).click();
  await expect.poll(() => submitted).toBeTruthy();
  const payload = submitted!;
  if (kind === 'non-photo') {
    expect(payload.photographer_id).toBeNull(); expect(payload.scheduled_at).toBe('2026-10-20T18:00:00.000Z');
    expect(payload.service_items).toEqual(expect.arrayContaining([
      expect.objectContaining({ service_id: '502', photographer_id: null, scheduled_at: '2026-10-20T18:00:00.000Z' }),
      expect.objectContaining({ service_id: '504', photographer_id: null, scheduled_at: '2026-10-20T19:00:00.000Z' }),
    ]));
  } else {
    expect(payload.photographer_id).toBe('201'); expect(payload.scheduled_at).toBe('2026-10-20T13:00:00.000Z');
    const rows = kind === 'multi' ? payload.service_lines : payload.service_items;
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ service_id: '501', photographer_id: '201', scheduled_at: '2026-10-20T13:00:00.000Z' })]));
    if (kind === 'multi') expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ unit_client_key: 'unit-2', photographer_id: '202', scheduled_at: '2026-10-20T17:00:00.000Z' })]));
    else expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ service_id: '503', photographer_id: '202', scheduled_at: '2026-10-20T15:00:00.000Z' })]));
  }
  expect(payload.property_details).toEqual(expect.objectContaining({ lockboxCode: 'QA123', lockboxLocation: 'Front door' }));
  expect(payload.notify_client).toBe(false); expect(payload.notify_photographer).toBe(false);
  expect(payload.total_quote).toBe(kind === 'multi' ? 371 : kind === 'mixed' ? 445.2 : 74.2);
});

test('complimentary reshoot keeps scheduling and compensation available after draft refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  await page.goto('/__qa?kind=reshoot');
  await page.getByRole('combobox', { name: 'Reason', exact: true }).click();
  await page.getByRole('option', { name: 'Missed area', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to services', exact: true }).click();
  await page.getByRole('button', { name: 'Select services', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select HDR Photos', exact: true }).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to schedule', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Time', exact: true })).toHaveCount(0);
  await typeTime(page, page.getByRole('button', { name: '12:15 PM', exact: true }), '9:45 AM');
  await page.getByRole('button', { name: /KK - Kumnith Keo/ }).click();
  await page.getByRole('button', { name: /Jay Snap/ }).click();
  await page.getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
  await page.getByRole('button', { name: 'CONFIRM', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review & compensation', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book Comp Reshoot', exact: true })).toBeEnabled();
  await expect(page.getByText('2026-10-20 at 9:45 AM', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Reason', exact: true })).toContainText('Missed area');
  await page.getByRole('button', { name: 'Continue to services', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to schedule', exact: true }).click();
  await page.getByRole('button', { name: 'CONFIRM', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Book Comp Reshoot', exact: true })).toBeEnabled();
  await expect(page.getByText('2026-10-20 at 9:45 AM', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Book Comp Reshoot', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, 'reshoot-review-mobile.png') });
});
