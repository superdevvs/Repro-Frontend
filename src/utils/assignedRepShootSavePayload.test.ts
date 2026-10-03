import { describe, expect, it } from 'vitest';
import {
  normalizeScheduleStamp,
  slimAssignedRepShootSavePayload,
} from './assignedRepShootSavePayload';

describe('slimAssignedRepShootSavePayload', () => {
  it('retains authorized travel confirmations for server validation', () => {
    expect(slimAssignedRepShootSavePayload({ photographer_id: 9, travel_override: true, travel_override_reason: 'Confirmed adjacent building', travel_override_confirmed: true, travel_override_confirmation_version: 'reviewed-warning', travel_location_confirmed: true, editor_id: 7 })).toEqual({ photographer_id: 9, travel_override: true, travel_override_reason: 'Confirmed adjacent building', travel_override_confirmed: true, travel_override_confirmation_version: 'reviewed-warning', travel_location_confirmed: true });
  });
  it('keeps photographer/notify and drops forbidden echo keys', () => {
    const slim = slimAssignedRepShootSavePayload({
      photographer_id: 1163,
      notify_photographer: true,
      notify_client: false,
      service_photographers: [{ service_id: 2, photographer_id: 1163 }],
      address: '17333 Kennebeck Lane',
      city: 'Shrewsbury',
      client_id: 1671,
      property_details: { sqft: 2112, presenceOption: 'self', source: 'pro.reprophotos.com' },
      bedrooms: null,
      status: 'scheduled',
      workflow_status: 'scheduled',
      notes: 'nope',
      base_quote: 199,
      total_quote: 199,
      tax_amount: 0,
      payment_status: 'unpaid',
      editor_id: 9,
      listing_type: 'for_sale',
      property_status: 'available',
      presenceOption: 'self',
      lockboxCode: null,
      access_notes: 'x',
      unit_count: 1,
      id: 149,
      service_id: 2,
      created_by: 1,
      scheduled_date: '2026-09-30',
      time: '14:30:00',
      services: [{ id: 2, scheduled_at: null, photographer_id: 1163, name: 'Photos' }],
      service_items: [{ service_id: 2, scheduled_at: null, photographer_id: 1163, editor_id: 3 }],
    }, { scheduledDate: '2026-09-30', time: '14:30:00' });

    expect(slim).toEqual({
      photographer_id: 1163,
      notify_photographer: true,
      notify_client: false,
      service_photographers: [{ service_id: 2, photographer_id: 1163 }],
    });
  });

  it('keeps schedule/service plan when the appointment time actually changes', () => {
    const slim = slimAssignedRepShootSavePayload({
      photographer_id: 1163,
      scheduled_date: '2026-09-30',
      time: '15:00:00',
      services: [{ id: 2, scheduled_at: '2026-09-30T19:00:00.000Z', photographer_id: 1163 }],
      notify_photographer: true,
      address: 'echo',
    }, { scheduledDate: '2026-09-30', time: '14:30:00' });

    expect(slim).toEqual({
      photographer_id: 1163,
      time: '15:00:00',
      services: [{ id: 2, scheduled_at: '2026-09-30T19:00:00.000Z' }],
      notify_photographer: true,
    });
  });

  it('keeps dirty per-service scheduled_at when top-level time still matches (#395)', () => {
    // Overview left booking time at 2pm (echo dropped) but the service line moved to 1pm.
    const slim = slimAssignedRepShootSavePayload({
      photographer_id: 1163,
      notify_photographer: true,
      notify_client: false,
      scheduled_date: '2026-10-07',
      time: '14:00:00',
      services: [{ id: 2, scheduled_at: '2026-10-07T13:00:00', photographer_id: 1163 }],
      service_items: [{ service_id: 2, scheduled_at: '2026-10-07T13:00:00', photographer_id: 1163 }],
    }, {
      scheduledDate: '2026-10-07',
      time: '14:00:00',
      services: [{ id: 2, scheduled_at: '2026-10-07T14:00:00' }],
      service_items: [{ service_id: 2, scheduled_at: '2026-10-07 14:00:00' }],
    });

    expect(slim).toEqual({
      photographer_id: 1163,
      notify_photographer: true,
      notify_client: false,
      services: [{ id: 2, scheduled_at: '2026-10-07T13:00:00' }],
      service_items: [{ service_id: 2, scheduled_at: '2026-10-07T13:00:00' }],
    });
  });


  it('keeps a quantity change and does not send empty service_photographers (shoot 379)', () => {
    const slim = slimAssignedRepShootSavePayload({
      photographer_id: 1104,
      notify_client: true,
      notify_photographer: false,
      service_photographers: [],
      scheduled_date: '2026-10-03',
      time: '10:00:00',
      services: [{ id: 1, quantity: 2, scheduled_at: '2026-10-03T10:00:00' }],
      service_items: [{ service_id: 1, quantity: 2, scheduled_at: '2026-10-03T10:00:00' }],
      address: '3254 Gleneagles Dr Silver Spring',
    }, {
      scheduledDate: '2026-10-03',
      time: '10:00',
      serviceItems: [{ id: 1, service_id: 1, quantity: 1, scheduled_at: '2026-10-03 10:00:00' }],
    });

    expect(slim).toEqual({
      photographer_id: 1104,
      notify_client: true,
      notify_photographer: false,
      services: [{ id: 1, quantity: 2, scheduled_at: '2026-10-03T10:00:00' }],
      service_items: [{ service_id: 1, quantity: 2, scheduled_at: '2026-10-03T10:00:00' }],
    });
    expect(slim).not.toHaveProperty('service_photographers');
  });

  it('keeps an added or removed service id instead of an empty photographer list', () => {
    const shoot = {
      scheduledDate: '2026-10-03',
      time: '10:00:00',
      serviceItems: [{ service_id: 1, quantity: 1, scheduled_at: '2026-10-03T10:00:00' }],
    };
    const added = slimAssignedRepShootSavePayload({
      photographer_id: 1104,
      notify_client: false,
      notify_photographer: true,
      service_photographers: [],
      services: [
        { id: 1, quantity: 1, scheduled_at: '2026-10-03T10:00:00' },
        { id: 4, quantity: 1, scheduled_at: '2026-10-03T10:00:00' },
      ],
    }, shoot);
    expect(added.services).toEqual([
      { id: 1, quantity: 1, scheduled_at: '2026-10-03T10:00:00' },
      { id: 4, quantity: 1, scheduled_at: '2026-10-03T10:00:00' },
    ]);
    expect(added).not.toHaveProperty('service_photographers');

    const removed = slimAssignedRepShootSavePayload({
      photographer_id: 1104,
      notify_client: false,
      service_photographers: [],
      services: [],
      service_items: [],
    }, shoot);
    expect(removed.services).toEqual([]);
    expect(removed.service_items).toEqual([]);
    expect(removed).not.toHaveProperty('service_photographers');
  });

  it('still strips an unchanged service echo and omits empty service_photographers', () => {
    const slim = slimAssignedRepShootSavePayload({
      photographer_id: 1104,
      notify_client: true,
      notify_photographer: true,
      service_photographers: [],
      services: [{ id: 1, quantity: 1, scheduled_at: '2026-10-03T10:00:00' }],
      service_items: [{ service_id: 1, quantity: 1, scheduled_at: '2026-10-03 10:00:00' }],
    }, {
      time: '10:00:00',
      serviceItems: [{ service_id: 1, quantity: 1, scheduled_at: '2026-10-03T10:00:00' }],
    });
    expect(slim).toEqual({
      photographer_id: 1104,
      notify_client: true,
      notify_photographer: true,
    });
  });

  it('still strips service plan when per-service scheduled_at matches the shoot', () => {
    const slim = slimAssignedRepShootSavePayload({
      photographer_id: 1163,
      notify_photographer: true,
      scheduled_date: '2026-10-07',
      time: '14:00:00',
      services: [{ id: 2, scheduled_at: '2026-10-07T14:00:00' }],
      service_items: [{ service_id: 2, scheduled_at: '2026-10-07T14:00:00' }],
    }, {
      scheduledDate: '2026-10-07',
      time: '14:00:00',
      service_items: [{ service_id: 2, scheduled_at: '2026-10-07T14:00:00' }],
    });

    expect(slim).toEqual({
      photographer_id: 1163,
      notify_photographer: true,
    });
  });
});

describe('normalizeScheduleStamp', () => {
  it('normalizes floating wall-clock and space-separated SQL stamps', () => {
    expect(normalizeScheduleStamp('2026-10-07T13:00:00')).toBe('2026-10-07T13:00');
    expect(normalizeScheduleStamp('2026-10-07 13:00:00')).toBe('2026-10-07T13:00');
  });
});
