import { expect, test } from '@playwright/test';
import { bookingScheduleFixture, reviewBooking, type Scenario } from './helpers/booking-schedule-fixture';

test.use({ timezoneId: 'America/New_York' });

for (const override of [undefined, 37]) {
  test(`Book Shoot Schedule: restored old default respects ${override ? 'manual duration' : 'current catalog'}`, async ({ page, baseURL }) => {
    const qa = await bookingScheduleFixture(page, baseURL, 'available', 'admin', { legacyDuration: 60, overrideDuration: override });
    const duration = override ?? 15;
    await expect(page.getByLabel('Selected duration for 10 Exterior HDR', { exact: true })).toHaveText(`${duration} min`);
    await reviewBooking(page);
    await expect.poll(() => qa.saves().length).toBe(1);
    expect((qa.saves()[0].body?.services as { duration_minutes: number }[])[0].duration_minutes).toBe(duration);
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

test('Book Shoot Schedule: duration has no slider while custom minutes and quick time trigger fresh checks', async ({ page, baseURL }, testInfo) => {
  const qa = await bookingScheduleFixture(page, baseURL, 'available');
  await expect(page.getByRole('slider', { name: 'Shoot duration for 10 Exterior HDR' })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Service duration', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.BOOKING_QA_OUTPUT ? `${process.env.BOOKING_QA_OUTPUT}/desktop-schedule-no-slider.png` : testInfo.outputPath('desktop-schedule-no-slider.png') });
  await page.getByRole('button', { name: 'Set custom duration for 10 Exterior HDR' }).click();
  await page.getByLabel('Custom duration for 10 Exterior HDR', { exact: true }).fill('20');
  await expect.poll(() => (qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.service_items as {duration_minutes: number}[] | undefined)?.[0].duration_minutes).toBe(20);
  await page.locator('[data-suggested-time="9:00 AM"]').click();
  await expect.poll(() => String(qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.scheduled_at)).toBe('2026-10-05T13:00:00.000Z');
  await page.getByLabel('Custom duration for 10 Exterior HDR', { exact: true }).fill('17');
  await expect.poll(() => (qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body?.service_items as {duration_minutes: number}[] | undefined)?.[0].duration_minutes).toBe(17);
  await reviewBooking(page);
  await expect.poll(() => qa.saves().length).toBe(1);
  expect((qa.saves()[0].body?.services as { duration_minutes: number }[])[0].duration_minutes).toBe(17);
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
  await page.getByRole('heading', { name: 'Service duration', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.BOOKING_QA_OUTPUT ? `${process.env.BOOKING_QA_OUTPUT}/mobile-schedule-no-slider.png` : testInfo.outputPath('mobile-schedule-no-slider.png') });
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
