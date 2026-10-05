import { expect, test } from '@playwright/test';
import { bookingScheduleFixture, reviewBooking } from './helpers/booking-schedule-fixture';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}px service access`, () => {
    test.use({ viewport });
    for (const role of ['admin', 'rep']) {
      for (const multiUnit of [false, true]) {
        test(`${role} can book outside client groups (${multiUnit ? 'multi-property' : 'standard'})`, async ({ page, baseURL }) => {
          const qa = await bookingScheduleFixture(page, baseURL, 'available', role, { restrictedClient: true, multiUnit });
          await reviewBooking(page);
          await expect.poll(() => qa.saves().length).toBe(1);
          const body = qa.saves()[0].body!;
          if (multiUnit) expect(body.service_lines).toEqual(expect.arrayContaining([expect.objectContaining({ service_id: '501' })]));
          else expect(body.services).toEqual(expect.arrayContaining([expect.objectContaining({ id: '501' })]));
          expect(qa.errors).toEqual([]);
        });
      }
    }
  });
}
