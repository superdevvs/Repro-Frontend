import { describe, expect, it } from 'vitest';
import { normalizeBookingAvailabilitySlots } from './bookingAvailabilitySlots';

describe('normalizeBookingAvailabilitySlots', () => {
  it('keeps only authorized display fields from valid slots', () => {
    expect(normalizeBookingAvailabilitySlots([{
      start_time: '10:00', end_time: '11:00', status: 'booked', shoot_id: '42',
      client_name: 'Example Client', address: '118 Example Lane', city: 'Baltimore', state: 'MD', zip: '21201',
      services: [{ id: '7', name: 'HDR Photos', payout: 90 }, null, { id: null, name: 'Invalid' }],
      client_email: 'private@example.test', notes: 'Private note',
    }])).toEqual([{
      start_time: '10:00', end_time: '11:00', status: 'booked', shoot_id: 42,
      client_name: 'Example Client', address: '118 Example Lane', city: 'Baltimore', state: 'MD', zip: '21201',
      services: [{ id: 7, name: 'HDR Photos' }],
    }]);
  });

  it('accepts redacted time-only slots and drops malformed records', () => {
    const slots = normalizeBookingAvailabilitySlots([
      null, {}, { start_time: '10:00' }, { start_time: 10, end_time: 11 },
      { start_time: '10:00', end_time: '11:00', shoot_id: null, client_name: {}, services: {} },
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ start_time: '10:00', end_time: '11:00', services: [] });
    expect(slots[0].shoot_id).toBeUndefined();
    expect(slots[0].client_name).toBeUndefined();
    expect(normalizeBookingAvailabilitySlots(null)).toEqual([]);
  });
});
