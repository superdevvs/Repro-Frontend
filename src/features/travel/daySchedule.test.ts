import { expect, it, vi } from 'vitest';
import { scheduleFieldsAfterVisit, shiftTravelVisit, visitDurationItems } from './daySchedule';
import { bookingDayScheduleHandler } from './bookingDayScheduleHandler';

const payload = { timezone: 'America/New_York', photographer_id: 9, scheduled_at: '2026-10-13T17:30:00Z', service_items: [
  { service_id: 1, service_name: 'Photos', duration_minutes: 75, photographer_id: 9, scheduled_at: '2026-10-13T17:30:00Z' },
  { service_id: 2, service_name: 'Later video', duration_minutes: 30, photographer_id: 9, scheduled_at: '2026-10-13T18:00:00Z' },
  { service_id: 3, service_name: 'Another photographer', duration_minutes: 60, photographer_id: 10, scheduled_at: '2026-10-13T17:30:00Z' },
] };
const change = { scheduledAt: '2026-10-13T17:45:00Z', offsetMinutes: 15, timezone: 'America/New_York', photographerId: 9,
  fromStart: '2026-10-13T17:30:00Z', fromEnd: '2026-10-13T18:45:00Z', serviceDurations: { '1': 45 } };
it('moves and resizes precisely the selected visit, preserving independent overlapping starts and photographers', () => {
  const next = shiftTravelVisit(payload, change);
  expect(next.service_items).toEqual([{ ...payload.service_items[0], scheduled_at: '2026-10-13T17:45:00.000Z', duration_minutes: 45 }, ...payload.service_items.slice(1)]);
  expect(visitDurationItems(payload, 9, change.fromStart, change.timezone)).toEqual([{ key: '1', name: 'Photos', duration_minutes: 75, min_minutes: 5, max_minutes: 300 }]);
});
it('updates only the selected overview service fields including an unpopulated duration', () => {
  expect(scheduleFieldsAfterVisit(payload, { '2': { time: '14:00', duration_minutes: 30 } }, change)).toEqual({
    '1': { date: '2026-10-13', time: '13:45', duration_minutes: 45 }, '2': { time: '14:00', duration_minutes: 30 },
  });
});
it('persists a duration-only change in the new booking form', () => {
  const setSchedules = vi.fn(); const setDate = vi.fn(); const setTime = vi.fn();
  bookingDayScheduleHandler({ date: new Date('2026-10-13T12:00:00'), time: '1:30 PM', setDate, setTime,
    setServiceSchedules: setSchedules, services: [{ id: '1', name: 'Photos', photographer_required: true }], photographer: '9' })({ ...change, offsetMinutes: 0, scheduledAt: change.fromStart });
  expect(setSchedules.mock.calls[0][0]({})).toEqual({ '1': { date: '2026-10-13', time: '13:30', duration_minutes: 45 } });
  expect(setDate).not.toHaveBeenCalled(); expect(setTime).not.toHaveBeenCalled();
});
