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
  it('checks a manual-address booking with no property metadata using the same omitted field as submission', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(Object.hasOwn(body, 'property_details') && body.property_details === null
        ? { errors: { property_details: ['The property details field must be an array.'] } }
        : { data: { enabled: true, status: 'available', available: true, reason_codes: [], transitions: [], alternatives: [], can_override: false } }),
      { status: Object.hasOwn(body, 'property_details') && body.property_details === null ? 422 : 200 });
    }));
    const { result } = renderHook(() => useBookingTravel({ ...base, clientId: 1164, address: '5806 Winner Avenue', zip: '21215',
      date: new Date(2026, 9, 14), time: '11:00 AM', photographer: '1163', propertyDetails: null,
      selectedServices: [{ id: '1', name: '25 HDR Photos', description: '', price: 175, shoot_duration_minutes: 45 }],
    }));
    const payload = await run();
    expect(payload).not.toHaveProperty('property_details');
    expect(payload).toMatchObject({ action_mode: 'create', client_id: 1164, address: '5806 Winner Avenue', zip: '21215',
      timezone: 'America/New_York', photographer_id: '1163', scheduled_at: '2026-10-14T15:00:00.000Z',
      service_items: [{ service_id: '1', photographer_id: '1163', duration_minutes: 45, scheduled_at: '2026-10-14T15:00:00.000Z' }],
    });
    expect(result.current.result?.available).toBe(true); expect(result.current.error).toBeNull(); expect(result.current.blocked).toBe(false);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).endsWith('/availability/feasibility'))).toBe(true);
  });
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
  it.each(['Asia/Kolkata', 'Asia/Calcutta'])('interprets new 9:30 AM as Eastern availability time from %s', async (zone) => {
    browserTimezone(zone);
    renderHook(() => useBookingTravel({ ...base, date: new Date(2026, 9, 2), time: '9:30 AM' }));
    const payload = await run();
    expect(payload.timezone).toBe('America/New_York');
    expect(payload.scheduled_at).toBe('2026-10-02T13:30:00.000Z');
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
    browserTimezone('Asia/Kolkata');
    const service_lines = [{ unit_client_key: 'a', service_id: '6', duration_minutes: 15, scheduled_at: '2026-10-05T13:00:00Z', photographer_id: '9' },
      { unit_client_key: 'b', service_id: '6', duration_minutes: 15, scheduled_at: '2026-10-05T13:15:00Z', photographer_id: '9' }];
    const unitPayload = vi.fn(() => ({ units: [{ client_key: 'a', label: '101' }, { client_key: 'b', label: '102' }], service_lines }));
    renderHook(() => useBookingTravel({ ...base, unitPayload }));
    const payload = await run(); expect(payload.service_lines).toEqual(service_lines); expect(payload).not.toHaveProperty('service_items');
    expect(unitPayload).toHaveBeenCalledWith('America/New_York');
    expect(payload.timezone).toBe('America/New_York');
  });
  it('uses the first resolved capture line in a fresh unit draft with no hidden header time', async () => {
    const service_lines = [{ unit_client_key: 'a', service_id: '6', duration_minutes: 15,
      scheduled_at: '2026-10-05T15:30:00Z', photographer_id: '10' }];
    renderHook(() => useBookingTravel({ ...base, time: '', photographer: '9', unitPayload: () => ({ service_lines }) }));
    const payload = await run();
    expect(payload.scheduled_at).toBe('2026-10-05T15:30:00.000Z');
    expect(payload.photographer_id).toBe('10');
    expect(payload.service_lines).toEqual(service_lines);
  });
});
