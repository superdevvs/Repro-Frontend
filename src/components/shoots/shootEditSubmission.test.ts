import { describe, expect, it } from 'vitest';
import { buildShootEditMutationRequest } from './shootEditSubmission';
import { shootEditTravelMode } from '@/features/travel/shootEditTravelMode';

describe('shoot edit update and approval routes', () => {
  it('uses normal PATCH for a confirmed rep edit and retains signed warning and assignment fields', () => {
    const warning = { force_save: true, force_save_confirmed: true, force_save_reason: 'Confirmed with photographer', force_save_confirmation_version: 'signed-edit' };
    const payload = { ...warning, services: [{ id: 8, price: 350, duration_minutes: 90 }],
      service_items: [{ service_id: 8, photographer_id: 1141, duration_minutes: 90 }], notify_client: false, notify_photographer: true };
    const request = buildShootEditMutationRequest('2379', { status: 'scheduled' }, payload, true, false);
    expect(request.url).toMatch(/\/api\/shoots\/2379$/); expect(request.method).toBe('PATCH');
    expect(request.payload).toMatchObject({ ...warning, notify_client: false, notify_photographer: true,
      service_photographers: [{ service_id: 8, photographer_id: 1141 }] });
    expect(request.payload.services).toEqual([{ id: 8, duration_minutes: 90 }]);
    expect(request.payload.service_items).toEqual([{ service_id: 8, duration_minutes: 90 }]);
  });
  it('retains admin fields on an existing update', () => {
    const payload = { services: [{ id: 8, price: 350 }], service_items: [{ service_id: 8, editor_id: 22, photographer_pay: 90 }] };
    expect(buildShootEditMutationRequest('2379', { workflow_status: 'scheduled' }, payload, false, true).payload).toBe(payload);
  });
  it.each(['requested', 'pending', ''])('keeps %s requests on the approval endpoint', status => {
    const request = buildShootEditMutationRequest('42', { status }, { photographer_id: 9 }, false, true);
    expect(request.url).toMatch(/\/42\/approve$/); expect(request.method).toBe('POST');
    expect(shootEditTravelMode({ status: 'scheduled', workflow_status: 'requested' })).toBe('approve');
  });
});
