import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBookingTravel } from './useBookingTravel';
type Options = Parameters<typeof useBookingTravel>[0];
const base: Options = { active: true, requestedOnly: false, clientId: 2, address: '1 Main St', city: 'Baltimore', state: 'MD', zip: '21201', date: new Date(2026, 9, 5), time: '09:00', photographer: '9', propertyDetails: { sqft: 1000 }, sqft: 1000,
  selectedServices: [{ id: '6', name: 'Exterior', description: '', price: 75, shoot_duration_minutes: 15, quantity: 2 }], servicePhotographers: {}, serviceSchedules: {} };
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { enabled: false, status: 'available', available: true } }))))); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const run = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(350); }); return JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string); };
const browserTimezone = (timeZone: string) => {
  const DateTimeFormat = Intl.DateTimeFormat;
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locales, options) {
    const formatter = new DateTimeFormat(locales, options);
    const resolved = formatter.resolvedOptions();
    vi.spyOn(formatter, 'resolvedOptions').mockReturnValue({ ...resolved, timeZone });
    return formatter;
  });
};
describe('booking preview uses the booked service itinerary', () => {
  it.each([
    { time: '9:00 AM', expected: '2026-10-05T13:00:00.000Z' },
    { time: '12:00 AM', expected: '2026-10-05T04:00:00.000Z' },
    { time: '12:00 PM', expected: '2026-10-05T16:00:00.000Z' },
    { time: '3:15 PM', expected: '2026-10-05T19:15:00.000Z' },
  ])('keeps the main preview and inherited service aligned after quick-select $time', async ({ time, expected }) => {
    browserTimezone('America/New_York');
    renderHook(() => useBookingTravel({ ...base, time }));
    const payload = await run();
    expect(payload.scheduled_at).toBe(expected);
    expect(payload.service_items[0].scheduled_at).toBe(expected);
  });
  it('canonicalizes the browser alias without changing the selected clock or preview/service parity', async () => {
    browserTimezone('Asia/Calcutta');
    renderHook(() => useBookingTravel({ ...base, time: '9:00 AM' }));
    const payload = await run();
    expect(payload.timezone).toBe('Asia/Kolkata');
    expect(payload.scheduled_at).toBe('2026-10-05T03:30:00.000Z');
    expect(payload.service_items[0].scheduled_at).toBe(payload.scheduled_at);
  });
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
