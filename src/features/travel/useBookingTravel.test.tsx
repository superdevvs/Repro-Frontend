import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBookingTravel } from './useBookingTravel';
type Options = Parameters<typeof useBookingTravel>[0];
const base: Options = { active: true, requestedOnly: false, clientId: 2, address: '1 Main St', city: 'Baltimore', state: 'MD', zip: '21201', date: new Date(2026, 9, 5), time: '09:00', photographer: '9', propertyDetails: { sqft: 1000 }, sqft: 1000,
  selectedServices: [{ id: '6', name: 'Exterior', description: '', price: 75, shoot_duration_minutes: 15, quantity: 2 }], servicePhotographers: {}, serviceSchedules: {} };
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { enabled: false, status: 'available', available: true } }))))); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const run = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(350); }); return JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string); };
describe('booking preview uses the booked service itinerary', () => {
  it('sends real capture duration without multiplying quantity or adding travel to service time', async () => {
    renderHook(() => useBookingTravel(base)); const payload = await run();
    expect(payload.service_items).toEqual([expect.objectContaining({ service_id: '6', quantity: 2, duration_minutes: 15, photographer_id: '9' })]);
    expect(payload.action_mode).toBe('create');
  });
  it('keeps explicit independent service times and assignments', async () => {
    renderHook(() => useBookingTravel({ ...base, shootId: '5', source: { timezone: 'America/New_York' },
      selectedServices: [...base.selectedServices, { id: '7', name: 'Video', description: '', price: 100, shoot_duration_minutes: 30 }],
      servicePhotographers: { '7': '10' }, serviceSchedules: { '7': { date: '2026-10-06', time: '15:00', duration_minutes: 83 } },
    })); const payload = await run();
    expect(payload.service_items).toEqual([expect.objectContaining({ scheduled_at: '2026-10-05T13:00:00.000Z', duration_minutes: 15 }), expect.objectContaining({ scheduled_at: '2026-10-06T19:00:00.000Z', duration_minutes: 83, photographer_id: '10' })]);
  });
  it('sends both same-building unit rows unchanged, with no frontend buffer or inferred extra package rows', async () => {
    const service_lines = [{ unit_client_key: 'a', service_id: '6', duration_minutes: 15, scheduled_at: '2026-10-05T13:00:00Z', photographer_id: '9' },
      { unit_client_key: 'b', service_id: '6', duration_minutes: 15, scheduled_at: '2026-10-05T13:15:00Z', photographer_id: '9' }];
    renderHook(() => useBookingTravel({ ...base, unitPayload: () => ({ units: [{ client_key: 'a', label: '101' }, { client_key: 'b', label: '102' }], service_lines }) }));
    const payload = await run(); expect(payload.service_lines).toEqual(service_lines); expect(payload).not.toHaveProperty('service_items');
  });
});
