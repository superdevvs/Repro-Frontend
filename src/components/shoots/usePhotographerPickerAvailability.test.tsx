import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichPickerPhotographer, pickerAvailabilityLabel, usePhotographerPickerAvailability } from './usePhotographerPickerAvailability';

vi.mock('@/utils/distanceUtils', () => ({ getCoordinatesFromAddress: vi.fn().mockResolvedValue(null) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const location = { address: '3806 Bartwood', city: 'Baltimore', state: 'MD', zip: '21201', latitude: 39, longitude: -76 };
const options = { active: true, scope: '5866', date: '2026-11-04', time: '13:00', location, photographerIds: ['1136'], groups: [] };
const row = { id: 1136, name: 'Delmar', net_available_slots: [{ start_time: '13:00', end_time: '15:00' }] };
const response = (data = [row]) => new Response(JSON.stringify({ data }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

describe('photographer day preview', () => {
  it('distinguishes pending, failed, and checked availability and retries a failed check', async () => {
    const request = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(request.promise).mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => usePhotographerPickerAvailability(options));
    expect(result.current.status).toBe('loading');
    expect(pickerAvailabilityLabel(result.current.status)).toBe('Checking availability…');
    await act(async () => request.resolve(new Response('{}', { status: 503 })));
    expect(result.current.status).toBe('error');
    expect(result.current.byId.size).toBe(0);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.byId.get('1136')).toMatchObject(row);
  });

  it('invalidates old data immediately on a date change and ignores a late previous response', async () => {
    const first = deferred<Response>(); const second = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const { result, rerender } = renderHook(({ date }) => usePhotographerPickerAvailability({ ...options, date }), { initialProps: { date: '2026-11-04' } });
    rerender({ date: '2026-11-05' });
    expect(result.current.status).toBe('loading');
    await act(async () => second.resolve(response([])));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => first.resolve(response()));
    expect(result.current.byId.size).toBe(0);
  });

  it('clears confirmed slots while the changed time is being checked', async () => {
    const next = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockReturnValueOnce(next.promise));
    const { result, rerender } = renderHook(({ time }) => usePhotographerPickerAvailability({ ...options, time }), { initialProps: { time: '13:00' } });
    await waitFor(() => expect(result.current.byId.has('1136')).toBe(true));
    rerender({ time: '14:00' });
    expect(result.current.status).toBe('loading');
    expect(result.current.byId.size).toBe(0);
  });

  it('never presents raw working hours or old slots as net availability', () => {
    const person = { id: '1136', name: 'Delmar', netAvailableSlots: row.net_available_slots };
    const checked = { id: 1136, availability_slots: row.net_available_slots, net_available_slots: [] };
    expect(enrichPickerPhotographer(person, checked).netAvailableSlots).toEqual([]);
    expect(enrichPickerPhotographer(person).netAvailableSlots).toEqual([]);
    expect(pickerAvailabilityLabel('ready', checked)).toBe('No available times for this visit');
    expect(pickerAvailabilityLabel('ready')).toBe('Availability not checked');
  });
});
