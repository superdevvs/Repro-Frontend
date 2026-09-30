import { describe, expect, it } from 'vitest';
import { slimAssignedRepShootSavePayload } from './assignedRepShootSavePayload';

describe('slimAssignedRepShootSavePayload', () => {
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
});
