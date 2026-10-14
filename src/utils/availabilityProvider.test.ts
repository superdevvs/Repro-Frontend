import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSchedulingDayAvailability } from '@/components/booking/useSchedulingDayAvailability';
import { getDayAvailability } from './availabilityProvider';

const date = new Date(2026, 9, 16, 12);
const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

beforeEach(() => { localStorage.setItem('authToken', 'local-availability-qa'); });
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe('authoritative day availability responses', () => {
  it.each([401, 403, 429, 500, 502, 503, 504])('rejects HTTP %s instead of claiming an empty or unconfigured day', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>request failed</html>', { status })));
    await expect(getDayAvailability('1150', date)).rejects.toThrow(`Availability request failed (${status}`);
  });

  it('preserves a network failure for the caller to show an error', async () => {
    const failure = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    await expect(getDayAvailability('1150', date)).rejects.toBe(failure);
  });

  it('preserves abort cancellation and forwards the authenticated day request unchanged', async () => {
    const controller = new AbortController();
    const failure = new DOMException('Aborted', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValue(failure);
    vi.stubGlobal('fetch', fetchMock);
    await expect(getDayAvailability('1150', date, controller.signal)).rejects.toBe(failure);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'POST', signal: controller.signal,
      headers: expect.objectContaining({ Authorization: 'Bearer local-availability-qa' }),
      body: JSON.stringify({ photographer_id: 1150, date: '2026-10-16' }),
    }));
  });

  it.each([{}, { data: null }, { data: {} }])('rejects an incomplete successful response rather than inventing an empty day', async data => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(data)));
    await expect(getDayAvailability('1150', date)).rejects.toThrow('Availability response was invalid');
  });

  it('preserves a confirmed empty successful response as not configured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ data: [], timezone: 'America/New_York' })));
    expect(await getDayAvailability('1150', date)).toEqual({ status: 'not-configured', day: {
      workingHours: null, blocked: [], fromConfig: false, timezone: 'America/New_York',
    } });
  });

  it('preserves an off-day response and its real blocked interval', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ data: [
      { start_time: '00:00', end_time: '23:59', status: 'unavailable' },
    ], timezone: 'America/New_York' })));
    expect(await getDayAvailability('1150', date)).toEqual({ status: 'empty', day: {
      workingHours: null, blocked: [{ start: '00:00', end: '23:59' }], fromConfig: false, timezone: 'America/New_York',
    } });
  });

  it('retains backend working hours and both booked and unavailable intervals', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ data: [
      { start_time: '09:00:00', end_time: '17:00:00', status: 'available' },
      { start_time: '12:00', end_time: '13:00', status: 'booked' },
      { start: '15:00', end: '15:30', status: 'unavailable' },
    ], timezone: 'America/New_York' })));
    expect(await getDayAvailability('1150', date)).toEqual({ status: 'success', day: {
      workingHours: { start: '09:00', end: '17:00' },
      blocked: [{ start: '12:00', end: '13:00' }, { start: '15:00', end: '15:30' }],
      fromConfig: true, timezone: 'America/New_York',
    } });
  });

  it('makes the real scheduling caller surface an HTTP failure as error, not not-configured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503, statusText: 'Service Unavailable' })));
    const setAvailabilityPanel = vi.fn();
    const setDayAvailability = vi.fn();
    const options = {
      date, photographer: '1150', canUseProtectedAvailability: true,
      availabilityDataDate: '2026-10-16', defaultServiceDate: '2026-10-16', photographerOptions: [],
      latestRequestRef: { current: 0 }, setAvailabilityPanel, setDayAvailability,
    };
    renderHook(() => useSchedulingDayAvailability(options));
    await waitFor(() => expect(setAvailabilityPanel).toHaveBeenLastCalledWith({
      kind: 'error', message: 'Availability request failed (503 Service Unavailable)',
    }));
    expect(setDayAvailability).toHaveBeenLastCalledWith(null);
    expect(setAvailabilityPanel).not.toHaveBeenCalledWith({ kind: 'not-configured' });
    expect(setAvailabilityPanel).not.toHaveBeenCalledWith({ kind: 'empty' });
  });
});
