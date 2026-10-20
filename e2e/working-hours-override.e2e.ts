import { expect, test } from '@playwright/test';
import { bookingScheduleFixture, reviewBooking } from './helpers/booking-schedule-fixture';

test.use({ timezoneId: 'Asia/Kolkata', video: 'off' });

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`superadmin books outside hours with deliberate confirmation at ${viewport.width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    const qa = await bookingScheduleFixture(page, baseURL, 'outside-hours', 'superadmin', { time: '4:55 PM' });
    await reviewBooking(page);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Book outside working hours' })).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'Appointment outside working hours' })).toContainText('4:55 PM EDT');
    const confirm = dialog.getByRole('button', { name: 'Confirm and book outside hours' });
    await expect(confirm).toBeDisabled(); expect(qa.saves()).toHaveLength(0);
    await dialog.getByLabel('Working-hours exception reason').fill('Photographer agreed to work after hours.');
    await expect(confirm).toBeEnabled();
    await confirm.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.BOOKING_QA_OUTPUT) await page.screenshot({ path: `${process.env.BOOKING_QA_OUTPUT}/hours-confirm-${viewport.width}.png` });
    await confirm.click();
    await expect.poll(() => qa.saves().length).toBe(1);
    expect(qa.saves()[0].body).toMatchObject({ working_hours_override: true, working_hours_override_confirmed: true,
      working_hours_override_reason: 'Photographer agreed to work after hours.', working_hours_override_confirmation_version: 'fixture-hours-confirmation' });
    expect(qa.errors).toEqual([]);
  });
}

for (const scenario of ['admin', 'overlap'] as const) {
  test(`outside-hours booking remains blocked for ${scenario}`, async ({ page, baseURL }) => {
    const qa = await bookingScheduleFixture(page, baseURL, scenario === 'overlap' ? 'hours-overlap' : 'outside-hours', scenario === 'admin' ? 'admin' : 'superadmin');
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect(page.getByRole('button', { name: 'Book Shoot', exact: true })).toBeDisabled();
    await expect(page.getByRole('dialog')).toHaveCount(0); expect(qa.saves()).toHaveLength(0);
  });
}
