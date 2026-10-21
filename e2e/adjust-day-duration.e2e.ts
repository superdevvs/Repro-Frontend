import { expect, test } from '@playwright/test';
import { bookingScheduleFixture } from './helpers/booking-schedule-fixture';

test.use({ timezoneId: 'Asia/Kolkata', video: 'off' });
for (const role of ['superadmin', 'salesRep']) for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`${role} adjusts selected current and previous durations atomically at ${viewport.width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize(viewport);
    const qa = await bookingScheduleFixture(page, baseURL, 'adjust-day', role);
    await page.getByRole('button', { name: 'Adjust this day', exact: true }).click();
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Adjust this day' }) });
    await expect(dialog.getByRole('slider', { name: 'Shoot duration for 10 Exterior HDR' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Set custom duration for 10 Exterior HDR' }).click();
    await dialog.getByRole('spinbutton', { name: 'Custom duration for 10 Exterior HDR' }).fill('10');
    await expect(dialog.getByText(/Selected booking: 10 min/)).toBeVisible();
    await dialog.getByRole('checkbox', { name: 'Allow changes to existing bookings' }).check();
    await dialog.getByRole('combobox', { name: 'Booking to adjust' }).selectOption('booked-prior');
    await dialog.getByRole('button', { name: 'Set custom duration for Previous photos' }).click();
    await dialog.getByRole('spinbutton', { name: 'Custom duration for Previous photos' }).fill('60');
    await expect(dialog.getByText(/Selected booking: 60 min/)).toBeVisible();
    await expect(dialog.getByText('This schedule has enough travel time.')).toBeVisible();
    const apply = dialog.getByRole('button', { name: 'Use this schedule', exact: true });
    await expect(apply).toBeEnabled();
    await apply.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.BOOKING_QA_OUTPUT) await page.screenshot({ path: `${process.env.BOOKING_QA_OUTPUT}/adjust-duration-${role}-${viewport.width}.png` });
    expect(qa.saves()).toHaveLength(0);
    await apply.click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body).toMatchObject({
      service_items: [{ duration_minutes: 10 }], schedule_adjustments: [{ shoot_id: 99000, service_durations: [{ shoot_service_id: 77, duration_minutes: 60 }] }],
    });
    await page.getByRole('button', { name: /^confirm$/i }).click();
    await expect(page.getByText('Review & Confirm', { exact: true })).toBeVisible();
    await expect.poll(() => qa.requests.filter(r => r.path.endsWith('/feasibility')).at(-1)?.body).toMatchObject({ service_items: [{ duration_minutes: 10 }] });
    await page.getByRole('button', { name: 'Book Shoot', exact: true }).click();
    await expect.poll(() => qa.saves().length).toBe(1);
    expect(qa.saves()[0].body).toMatchObject({ services: [{ duration_minutes: 10 }],
      schedule_adjustments: [{ shoot_id: 99000, service_durations: [{ shoot_service_id: 77, duration_minutes: 60 }] }] });
    expect(qa.errors).toEqual([]);
  });
}
