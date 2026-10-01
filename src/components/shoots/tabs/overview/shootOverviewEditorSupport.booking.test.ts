import { describe, expect, it } from 'vitest';
import { mapPhotographerPickerOption } from './shootOverviewEditorSupport';

describe('booked appointment details in the edit picker', () => {
  it('preserves only the authorized detail fields returned on a booked slot', () => {
    const option = mapPhotographerPickerOption({ id: 1, name: 'Photographer', booked_slots: [{
      start_time: '10:00', end_time: '11:00', shoot_id: 42, client_name: 'Sample Client',
      address: '118 Example Lane', services: [{ id: 7, name: 'HDR Photography', price: 999 }],
      client_email: 'private@example.test',
    }] });
    expect(option.bookedSlots?.[0]).toMatchObject({
      start_time: '10:00', end_time: '11:00', shoot_id: 42, client_name: 'Sample Client',
      address: '118 Example Lane', services: [{ id: 7, name: 'HDR Photography' }],
    });
    expect(option.bookedSlots?.[0]).not.toHaveProperty('client_email');
    expect(option.bookedSlots?.[0].services?.[0]).not.toHaveProperty('price');
  });

  it('does not infer booking details from photographer profile or other response fields', () => {
    const option = mapPhotographerPickerOption({ id: 1, name: 'Photographer', address: 'Home address',
      client_name: 'Unrelated client', services: [{ id: 7, name: 'Unrelated service' }],
      booked_slots: [{ start_time: '10:00', end_time: '11:00' }],
    });
    expect(option.bookedSlots?.[0].client_name).toBeUndefined();
    expect(option.bookedSlots?.[0].address).toBeUndefined();
    expect(option.bookedSlots?.[0].services).toEqual([]);
    expect(option.bookedSlots?.[0].shoot_id).toBeUndefined();
  });
});
