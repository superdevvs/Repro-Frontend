import { expect, test } from '@playwright/test';
import { bookingScheduleFixture, reviewBooking, type Scenario } from './helpers/booking-schedule-fixture';

test.use({ timezoneId: 'America/New_York' });

for (const override of [undefined, 37]) {
  test(`Book Shoot Schedule: restored ${override ? 'manual overrides' : 'old default'} uses current catalog duration`, async ({ page, baseURL }) => {
    const qa = await bookingScheduleFixture(page, baseURL, 'available', 'admin', { legacyDuration: 60, overrideDuration: override, selectedDuration: override ? 45 : undefined, catalogDuration: 30 });
    await expect(page.getByRole('heading', { name: 'Service duration', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Set custom duration/ })).toHaveCount(0);
    await expect.poll(() => (qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.service_items as {duration_minutes: number}[] | undefined)?.[0].duration_minutes).toBe(30);
    expect(qa.requests.filter(r => r.path.endsWith('/for-booking')).at(-1)?.body?.duration_minutes).toBe(30);
    await reviewBooking(page);
    await expect.poll(() => qa.saves().length).toBe(1);
    expect((qa.saves()[0].body?.services as { duration_minutes: number }[])[0].duration_minutes).toBe(30);
    expect(qa.errors).toEqual([]);
  });
}

test.describe('browser timezone alias', () => {
  test.use({ timezoneId: 'Asia/Kolkata' });
  test('Book Shoot Schedule: India browser uses canonical timezone and matching preview/save clocks', async ({ page, baseURL }) => {
    const qa = await bookingScheduleFixture(page, baseURL, 'available');
    const preview = qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body;
    expect(preview).toMatchObject({ timezone: 'Asia/Kolkata', scheduled_at: '2026-10-05T03:00:00.000Z' });
    await reviewBooking(page);
    await expect.poll(() => qa.saves().length).toBe(1);
    expect(qa.saves()[0].body).toMatchObject({ timezone: 'Asia/Kolkata' });
    expect((qa.saves()[0].body?.services as { scheduled_at: string }[])[0].scheduled_at).toBe('2026-10-05T03:00:00.000Z');
    expect(qa.errors).toEqual([]);
  });
});

for (const scenario of ['available', 'same-building', 'disabled'] as Scenario[]) {
  test(`Book Shoot Schedule: ${scenario} keeps a 15-minute exterior visit through review and save`, async ({ page, baseURL }) => {
    const qa = await bookingScheduleFixture(page, baseURL, scenario);
    if (scenario === 'same-building') await expect(page.getByText('Same confirmed building · no travel allowance between units.')).toBeVisible();
    if (scenario === 'disabled') await expect(page.getByRole('region', { name: 'Travel feasibility' })).toHaveCount(0);
    await reviewBooking(page);
    await expect.poll(() => qa.saves().length).toBe(1);
    const services = qa.saves()[0].body?.services as { duration_minutes: number; scheduled_at: string }[];
    expect(services[0].duration_minutes).toBe(15);
    expect(new Date(services[0].scheduled_at).toISOString()).toBe('2026-10-05T12:30:00.000Z');
    expect(qa.saves()[0].body?.travel_override_confirmed).toBeUndefined();
    expect(qa.errors).toEqual([]);
  });
}

for (const role of ['admin', 'rep']) {
  test(`Book Shoot Schedule: ${role} reviews outgoing travel and swipes once to save`, async ({ page, baseURL }) => {
    const qa = await bookingScheduleFixture(page, baseURL, 'outgoing', role);
    await expect(page.getByText('25 min needed · 15 min available · 10 min short')).toBeVisible();
    await page.getByRole('button', { name: 'Find up to 3 alternatives' }).click();
    await expect(page.getByText(/Oct 5.*9:10 AM/)).toBeVisible();
    await reviewBooking(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Do you still want to book at this time?')).toBeVisible();
    await expect(dialog.getByText(/9:00 AM.*9:15 AM/)).toBeVisible();
    const swipe = dialog.getByRole('slider', { name: 'Swipe to confirm travel exception' });
    await expect(swipe).toBeDisabled();
    expect(qa.saves()).toHaveLength(0);
    await dialog.getByLabel('Travel exception reason', { exact: true }).fill('Photographer confirmed access and timing');
    await swipe.focus(); await page.keyboard.press('End');
    expect(qa.saves()).toHaveLength(0);
    await page.keyboard.press('Enter');
    await expect.poll(() => qa.saves().length).toBe(1);
    expect(qa.saves()[0].body).toMatchObject({ travel_override: true, travel_override_confirmed: true, travel_override_reason: 'Photographer confirmed access and timing', travel_override_confirmation_version: 'fixture-confirmation' });
    expect(qa.errors).toEqual([]);
  });
}

test('Book Shoot Schedule: capture overlap blocks confirmation with no override', async ({ page, baseURL }) => {
  const qa = await bookingScheduleFixture(page, baseURL, 'overlap');
  await expect(page.getByText('The shoot overlaps another appointment. Choose another time or photographer.')).toBeVisible();
  await page.getByRole('button', { name: /^confirm$/i }).click();
  await expect(page.getByText('Review & Confirm', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Book Shoot', exact: true })).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(qa.saves()).toHaveLength(0);
});

test('Book Shoot Schedule: configured duration stays automatic while quick time triggers fresh checks', async ({ page, baseURL }, testInfo) => {
  const qa = await bookingScheduleFixture(page, baseURL, 'available');
  await expect(page.getByRole('slider', { name: 'Shoot duration for 10 Exterior HDR' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Service duration', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Set custom duration/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^confirm$/i }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.BOOKING_QA_OUTPUT ? `${process.env.BOOKING_QA_OUTPUT}/desktop-schedule-catalog-duration.png` : testInfo.outputPath('desktop-schedule-catalog-duration.png') });
  await page.locator('[data-suggested-time="9:00 AM"]').click();
  await expect.poll(() => String(qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.scheduled_at)).toBe('2026-10-05T13:00:00.000Z');
  await expect.poll(() => (qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.service_items as {duration_minutes: number}[] | undefined)?.[0].duration_minutes).toBe(15);
  await reviewBooking(page);
  await expect.poll(() => qa.saves().length).toBe(1);
  expect((qa.saves()[0].body?.services as { duration_minutes: number }[])[0].duration_minutes).toBe(15);
  expect(qa.errors).toEqual([]);
});

test('Book Shoot Schedule: incoming shortage remains visible through review on desktop', async ({ page, baseURL }, testInfo) => {
  const qa = await bookingScheduleFixture(page, baseURL, 'incoming');
  await expect(page.getByText('From previous appointment', { exact: true })).toBeVisible();
  await reviewBooking(page);
  await expect(page.getByRole('dialog').getByText(/8:00 AM.*8:15 AM/)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: process.env.BOOKING_QA_OUTPUT ? `${process.env.BOOKING_QA_OUTPUT}/desktop-booking-warning.png` : testInfo.outputPath('desktop-booking-warning.png') });
  await page.getByRole('button', { name: 'Go back without saving' }).click();
  expect(qa.saves()).toHaveLength(0);
  expect(qa.errors).toEqual([]);
});

test('Book Shoot Schedule: mobile unknown route reaches review and cancel sends no booking', async ({ page, baseURL }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const qa = await bookingScheduleFixture(page, baseURL, 'unknown');
  await expect(page.getByRole('slider', { name: 'Shoot duration for 10 Exterior HDR' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Service duration', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Set custom duration/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^confirm$/i }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.BOOKING_QA_OUTPUT ? `${process.env.BOOKING_QA_OUTPUT}/mobile-schedule-catalog-duration.png` : testInfo.outputPath('mobile-schedule-catalog-duration.png') });
  await expect(page.getByText('Travel allowance is not yet known.')).toBeVisible();
  await reviewBooking(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: process.env.BOOKING_QA_OUTPUT ? `${process.env.BOOKING_QA_OUTPUT}/mobile-booking-warning.png` : testInfo.outputPath('mobile-booking-warning.png') });
  await page.getByRole('button', { name: 'Go back without saving' }).click();
  expect(qa.saves()).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  expect(qa.errors).toEqual([]);
});

for (const role of ['admin', 'rep']) {
  test(`Book Shoot warning: ${role} adjusts duration, rechecks and confirms only the current itinerary`, async ({ page, baseURL }, testInfo) => {
    if (role === 'rep') await page.setViewportSize({ width: 390, height: 844 });
    else await page.setViewportSize({ width: 1365, height: 1100 });
    const qa = await bookingScheduleFixture(page, baseURL, 'outgoing', role);
    await reviewBooking(page);
    const dialog = page.getByRole('dialog');
    const previousToken = qa.previews.at(-1)?.confirmation_version;
    await dialog.getByRole('button', { name: 'Adjust duration', exact: true }).click();
    await dialog.getByRole('button', { name: 'Set custom duration for 10 Exterior HDR', exact: true }).click();
    await dialog.getByLabel('Custom duration for 10 Exterior HDR', { exact: true }).fill('17');
    await dialog.getByLabel('Travel exception reason', { exact: true }).fill('Earlier reason must be reviewed again');
    await expect(dialog.getByRole('slider', { name: 'Swipe to confirm travel exception' })).toBeDisabled();
    const screenshot = `${role === 'admin' ? 'desktop' : 'mobile'}-warning-duration-adjustment.png`;
    await dialog.getByRole('button', { name: 'Apply duration and recheck', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: process.env.BOOKING_QA_OUTPUT ? `${process.env.BOOKING_QA_OUTPUT}/${screenshot}` : testInfo.outputPath(screenshot) });
    const requestsBeforeApply = qa.previews.length;
    await dialog.getByRole('button', { name: 'Apply duration and recheck', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(qa.saves()).toHaveLength(0);
    await expect.poll(() => qa.previews.length).toBeGreaterThan(requestsBeforeApply);
    await expect.poll(() => (qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.service_items as { duration_minutes: number }[] | undefined)?.[0].duration_minutes).toBe(17);
    await expect(page.getByRole('button', { name: 'Book Shoot', exact: true })).toBeEnabled();
    expect(qa.previews.at(-1)?.confirmation_version).not.toBe(previousToken);
    expect(qa.saves()).toHaveLength(0);
    await page.getByRole('button', { name: 'Book Shoot', exact: true }).click();
    await dialog.getByRole('button', { name: 'Adjust duration', exact: true }).click();
    await expect(dialog.getByLabel('Selected duration for 10 Exterior HDR', { exact: true })).toHaveText('17 min');
    await expect(dialog.getByLabel('Travel exception reason', { exact: true })).toHaveValue('');
    await dialog.getByLabel('Travel exception reason', { exact: true }).fill('Photographer confirmed the revised visit duration');
    const swipe = dialog.getByRole('slider', { name: 'Swipe to confirm travel exception' });
    await swipe.focus(); await page.keyboard.press('End');
    expect(qa.saves()).toHaveLength(0);
    await page.keyboard.press('Enter');
    await expect.poll(() => qa.saves().length).toBe(1);
    expect((qa.saves()[0].body?.services as { duration_minutes: number }[])[0].duration_minutes).toBe(17);
    expect(qa.saves()[0].body?.travel_override_confirmation_version).toBe(qa.previews.at(-1)?.confirmation_version);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    expect(qa.errors).toEqual([]);
  });
}

test('Book Shoot warning: invalid or cancelled duration edits never change the itinerary', async ({ page, baseURL }) => {
  const qa = await bookingScheduleFixture(page, baseURL, 'outgoing');
  await reviewBooking(page);
  const dialog = page.getByRole('dialog');
  const previewCount = qa.previews.length;
  await dialog.getByRole('button', { name: 'Adjust duration', exact: true }).click();
  await dialog.getByLabel('Travel exception reason', { exact: true }).fill('Photographer confirmed the original timing');
  await dialog.getByRole('button', { name: 'Set custom duration for 10 Exterior HDR', exact: true }).click();
  const input = dialog.getByLabel('Custom duration for 10 Exterior HDR', { exact: true });
  for (const value of ['', '4', '301', '17.5']) {
    await input.fill(value);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByRole('button', { name: 'Apply duration and recheck', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('slider', { name: 'Swipe to confirm travel exception' })).toBeDisabled();
  }
  await dialog.getByRole('button', { name: 'Cancel duration changes', exact: true }).click();
  await expect(dialog.getByLabel('Selected duration for 10 Exterior HDR', { exact: true })).toHaveText('15 min');
  await expect(dialog.getByRole('slider', { name: 'Swipe to confirm travel exception' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Set custom duration for 10 Exterior HDR', exact: true }).click();
  await dialog.getByLabel('Custom duration for 10 Exterior HDR', { exact: true }).fill('20');
  await dialog.getByRole('button', { name: 'Go back without saving', exact: true }).click();
  expect(qa.previews).toHaveLength(previewCount);
  expect(qa.saves()).toHaveLength(0);
  await page.getByRole('button', { name: 'Book Shoot', exact: true }).click();
  await dialog.getByRole('button', { name: 'Adjust duration', exact: true }).click();
  await expect(dialog.getByLabel('Selected duration for 10 Exterior HDR', { exact: true })).toHaveText('15 min');
  await dialog.getByRole('button', { name: 'Go back without saving', exact: true }).click();
  expect(qa.errors).toEqual([]);
});

test('Book Shoot warning: adjusting one unit changes only that line and shifts its next sequential visit', async ({ page, baseURL }) => {
  const qa = await bookingScheduleFixture(page, baseURL, 'incoming', 'admin', { multiUnit: true });
  await reviewBooking(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Adjust duration', exact: true }).click();
  await dialog.getByRole('button', { name: 'Set custom duration for 10 Exterior HDR · Unit 1', exact: true }).click();
  await dialog.getByLabel('Custom duration for 10 Exterior HDR · Unit 1', { exact: true }).fill('20');
  await dialog.getByRole('button', { name: 'Apply duration and recheck', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  type Line = { client_key: string; duration_minutes: number; scheduled_at: string };
  await expect.poll(() => (qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.service_lines as Line[] | undefined)?.map(line => line.duration_minutes)).toEqual([20, 15]);
  const previewLines = qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.service_lines as Line[];
  expect(previewLines).toEqual(expect.arrayContaining([
    expect.objectContaining({ client_key: 'line-1', duration_minutes: 20, scheduled_at: '2026-10-05T12:30:00.000Z' }),
    expect.objectContaining({ client_key: 'line-2', duration_minutes: 15, scheduled_at: '2026-10-05T12:50:00.000Z' }),
  ]));
  expect(qa.saves()).toHaveLength(0);
  await page.getByRole('button', { name: 'Book Shoot', exact: true }).click();
  await dialog.getByLabel('Travel exception reason', { exact: true }).fill('Confirmed both units and the revised total visit');
  await dialog.getByRole('slider', { name: 'Swipe to confirm travel exception' }).focus();
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await expect.poll(() => qa.saves().length).toBe(1);
  expect(qa.saves()[0].body?.service_lines).toEqual(previewLines);
  expect(qa.saves()[0].body?.travel_override_confirmation_version).toBe(qa.previews.at(-1)?.confirmation_version);
  expect(qa.errors).toEqual([]);
});

test('Book Shoot warning: client request keeps the warning without staff duration controls', async ({ page, baseURL }) => {
  const qa = await bookingScheduleFixture(page, baseURL, 'incoming', 'client');
  await expect(page.getByRole('heading', { name: 'Service duration', exact: true })).toHaveCount(0);
  await expect(page.getByText('From previous appointment', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adjust duration', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^confirm$/i }).click();
  await expect(page.getByText('Review & Confirm', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request Shoot', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Adjust duration', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Adjust proposed service duration', exact: true })).toHaveCount(0);
  expect(qa.saves()).toHaveLength(0);
  expect(qa.errors).toEqual([]);
});
