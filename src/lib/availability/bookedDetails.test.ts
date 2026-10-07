import { describe, expect, it } from 'vitest';
import { mapBackendSlots, mergeBookedSlots } from './utils';
import { buildSelectedDateAvailabilities } from './selectors';

describe('booked availability details', () => {
  it('retains identity/details and merges duplicate thin and rich rows across selectors', () => {
    const thin = { id: 'booking-1', photographer_id: 10, shoot_id: 2386, date: '2026-10-09', start_time: '11:00:00', end_time: '12:05:00', status: 'booked' };
    const details = { id: 2386, title: '5156 Woodmire', address: '5156 Woodmire Ln', shoot_status: 'scheduled',
      client: { id: 20, name: 'Client', email: 'muted@example.invalid' }, services: [{ id: 17, name: 'Floor Plans', price: 125 }] };
    const rows = mapBackendSlots([thin, { ...thin, id: 'rich-booking', shoot_id: '2386', shoot_details: details }], '10');
    const merged = mergeBookedSlots(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('booking-1');
    expect(merged[0].shoot_details).toEqual(details);
    const cards = buildSelectedDateAvailabilities({ selectedPhotographer: '10', backendSlots: rows, allBackendSlots: [] }, new Date(2026, 9, 9));
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ shoot_id: 2386, shootTitle: '5156 Woodmire', shootDetails: details });
  });
  it('never merges distinct shoots or differently timed visits', () => {
    const base = { photographer_id: 10, date: '2026-10-09', start_time: '11:00', end_time: '12:00', status: 'booked' };
    expect(mergeBookedSlots(mapBackendSlots([{ ...base, shoot_id: 1 }, { ...base, shoot_id: 2 }, { ...base, shoot_id: 1, start_time: '14:00' }], '10'))).toHaveLength(3);
  });
});
