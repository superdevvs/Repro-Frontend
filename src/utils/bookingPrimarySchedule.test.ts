import { describe, expect, it } from 'vitest';
import { bookingPrimarySchedule, restoreBookingServiceSchedules } from './bookingPrimarySchedule';
import { getSchedulingStepErrors } from '@/pages/bookShootModel';
import { shiftTravelVisit } from '@/features/travel/daySchedule';

const photo = { id: 'p', name: 'Photos', photographer_required: true };
const staging = { id: 's', name: 'Staging', photographer_required: false };
const date = new Date(2026, 9, 20, 12);
describe('effective booking schedule', () => {
  it('restores inherited clocks from old drafts but preserves a new explicit clear', () => {
    const rows = { p: { time: '', duration_minutes: 30 } };
    expect(restoreBookingServiceSchedules(rows, undefined)).toEqual({ p: { duration_minutes: 30 } });
    expect(restoreBookingServiceSchedules(rows, 2)).toEqual(rows);
  });
  it('uses the visible service assignment instead of a stale shoot-level photographer and time', () => {
    expect(bookingPrimarySchedule([photo], { p: { time: '09:00' } }, date, '12:15 PM', 'jay', { p: 'kk' }))
      .toEqual({ date: '2026-10-20', time: '09:00', photographer: 'kk' });
  });
  it('anchors a mixed booking on the capture service even if staging is first', () => {
    expect(bookingPrimarySchedule([staging, photo], { p: { time: '09:00' }, s: { time: '14:00' } }, date, '', 'kk', {}))
      .toEqual({ date: '2026-10-20', time: '09:00', photographer: 'kk' });
  });
  it('takes the no-photographer appointment from its row and has no photographer', () => {
    expect(bookingPrimarySchedule([staging], { s: { time: '14:00' } }, date, '12:15 PM', 'jay', {}))
      .toEqual({ date: '2026-10-20', time: '14:00', photographer: null });
  });
  it('does not replace an explicitly cleared service time with a hidden default', () => {
    expect(bookingPrimarySchedule([staging], { s: { time: '' } }, date, '12:15 PM', '', {}).time).toBe('');
    expect(getSchedulingStepErrors({ date, time: '12:15 PM', selectedServices: [staging], serviceSchedules: { s: { time: '' } } }))
      .toEqual({ 'service.s.time': 'Choose a time for Staging' });
  });
  it('accepts complete service schedules in a fresh draft without a hidden default time', () => {
    expect(getSchedulingStepErrors({ date, time: '', photographer: 'kk', selectedServices: [photo, staging],
      serviceSchedules: { p: { time: '09:00' }, s: { time: '14:00' } } })).toEqual({});
  });
  it('moves one photographer visit without moving another photographer or staging', () => {
    const payload = { timezone: 'America/New_York', photographer_id: 1, scheduled_at: '2026-10-20T13:00:00Z', service_items: [
      { service_id: 'p', photographer_id: 1, scheduled_at: '2026-10-20T13:00:00Z' },
      { service_id: 'v', photographer_id: 2, scheduled_at: '2026-10-20T14:00:00Z' },
      { service_id: 's', photographer_id: null, scheduled_at: '2026-10-20T18:00:00Z' },
    ] };
    const next = shiftTravelVisit(payload, { scheduledAt: '2026-10-20T13:30:00Z', offsetMinutes: 30, timezone: 'America/New_York',
      photographerId: 1, fromStart: '2026-10-20T13:00:00Z', fromEnd: '2026-10-20T13:45:00Z' });
    expect(next.scheduled_at).toBe('2026-10-20T13:30:00.000Z');
    expect(next.service_items).toEqual([ { ...payload.service_items[0], scheduled_at: '2026-10-20T13:30:00.000Z' }, ...payload.service_items.slice(1) ]);
  });
  it('preserves floating legacy clocks when adjusting only one photographer visit', () => {
    const payload = { photographer_id: 1, scheduled_at: '2026-10-20T09:00:00Z', service_items: [
      { service_id: 'p', photographer_id: 1, scheduled_at: '2026-10-20T09:00:00Z' },
      { service_id: 'v', photographer_id: 2, scheduled_at: '2026-10-20T11:00:00Z' },
    ] };
    const next = shiftTravelVisit(payload, { scheduledAt: '2026-10-20T13:30:00Z', offsetMinutes: 30, timezone: 'America/New_York',
      photographerId: 1, fromStart: '2026-10-20T13:00:00Z', fromEnd: '2026-10-20T13:30:00Z' });
    expect(next.scheduled_at).toBe('2026-10-20T09:30:00');
    expect(next.service_items[0].scheduled_at).toBe('2026-10-20T09:30:00');
    expect(next.service_items[1]).toEqual(payload.service_items[1]);
  });
});
