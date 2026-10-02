import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTravelFeasibility } from './useTravelFeasibility';
import type { TravelFeasibility } from './types';

const available: TravelFeasibility = { enabled: true, status: 'available', available: true, reason_codes: [], transitions: [], alternatives: [], can_override: false, policy_version: '1', schedule_version: '1' };
const conflict = { ...available, status: 'conflict' as const, available: false, can_override: true, reason_codes: ['insufficient_travel_time'] };
const payload = { client_id: 2, address: '1 Main St', scheduled_at: '2026-10-05T13:00:00Z', photographer_id: 9 };
const response = (value = available, status = 200) => new Response(JSON.stringify({ data: value }), { status });
const tick = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(350); }); };
beforeEach(() => { vi.useFakeTimers(); localStorage.setItem('authToken', 'test'); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('selected itinerary travel preview', () => {
  it('debounces changes into one authenticated request and fetches alternatives only on demand', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response())); vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    rerender({ payload: { ...payload, address: '2 Main St' } });
    expect(fetcher).not.toHaveBeenCalled(); expect(result.current.loading).toBe(true);
    await tick();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ address: '2 Main St', include_alternatives: false });
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test');
    await act(async () => { await result.current.loadAlternatives(); });
    expect(JSON.parse(fetcher.mock.calls[1][1].body).include_alternatives).toBe(true);
  });
  it('aborts stale work and ignores even a late response from a transport that ignores abort', async () => {
    let finishOld: (value: Response) => void = () => {};
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishOld = resolve; })).mockImplementationOnce(() => Promise.resolve(response()));
    vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    await tick(); rerender({ payload: { ...payload, address: '2 Main St' } });
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    await tick(); await act(async () => finishOld(response(conflict)));
    expect(result.current.result?.status).toBe('available');
  });
  it('requires server permission and a nonblank reason; schedule changes discard approval immediately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(conflict))));
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    await tick(); expect(result.current.blocked).toBe(true);
    act(() => result.current.setOverrideChecked(true));
    act(() => result.current.setOverrideReason('  ')); expect(result.current.blocked).toBe(true);
    act(() => result.current.setOverrideReason('four')); expect(result.current.blocked).toBe(true);
    act(() => result.current.setOverrideReason('Building manager confirmed access'));
    expect(result.current.confirmation).toEqual({ travel_override: true, travel_override_reason: 'Building manager confirmed access' });
    expect(result.current.blocked).toBe(false);
    rerender({ payload: { ...payload, scheduled_at: '2026-10-05T14:00:00Z' } });
    expect(result.current.confirmation).toEqual({}); expect(result.current.blocked).toBe(true);
  });
  it('cannot forge an override without server permission, and preserves client request submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response({ ...conflict, can_override: false }))));
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload, requestedOnly: false } });
    await tick(); act(() => result.current.setOverrideChecked(true)); act(() => result.current.setOverrideReason('reason'));
    expect(result.current.confirmation).toEqual({}); expect(result.current.blocked).toBe(true);
    rerender({ payload, requestedOnly: true }); expect(result.current.blocked).toBe(false);
  });
  it('rechecks a building confirmation and clears it after an address change', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response(conflict))); vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    await tick(); act(() => result.current.setLocationConfirmed(true));
    expect(result.current.result).toBeNull(); await tick();
    expect(JSON.parse(fetcher.mock.calls[1][1].body).travel_location_confirmed).toBe(true);
    expect(result.current.confirmation).toEqual({ travel_location_confirmed: true });
    rerender({ payload: { ...payload, address: '3 Main St' } }); expect(result.current.locationConfirmed).toBe(false);
    await tick(); expect(JSON.parse(fetcher.mock.calls[2][1].body)).not.toHaveProperty('travel_location_confirmed');
  });
  it('uses a structured save conflict and invalidates the old exception, but ignores a stale save failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response())));
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } }); await tick();
    const oldHandler = result.current.acceptServerError;
    act(() => result.current.acceptServerError({ feasibility: { ...conflict, schedule_version: '2' } }));
    expect(result.current.result?.schedule_version).toBe('2'); expect(result.current.blocked).toBe(true);
    rerender({ payload: { ...payload, address: '3 Main St' } }); await tick();
    act(() => { expect(oldHandler({ feasibility: conflict })).toBe(false); });
    expect(result.current.result?.status).toBe('available');
  });
  it('keeps the legacy flow when disabled and never treats network failure as a successful check', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ ...available, enabled: false })).mockRejectedValueOnce(new Error('Network unavailable'));
    vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } }); await tick();
    expect(result.current.visible).toBe(false); expect(result.current.blocked).toBe(false);
    rerender({ payload: { ...payload, address: '3 Main St' } }); await tick();
    expect(result.current.result).toBeNull(); expect(result.current.error).toBe('Network unavailable'); expect(result.current.visible).toBe(true);
  });
  it('does not refetch for random draft line identities in an existing multi-unit edit', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response())); vi.stubGlobal('fetch', fetcher);
    const makePayload = (key: string) => ({ ...payload, shoot_id: 4, units: [{ client_key: 'unit1' }], service_lines: [{ client_key: key, unit_client_key: 'unit1', service_id: 6 }] });
    const { rerender } = renderHook(useTravelFeasibility, { initialProps: { payload: makePayload('a') } }); await tick();
    rerender({ payload: makePayload('b') }); await tick(); expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.parse(fetcher.mock.calls[0][1].body).units[0].client_key).toBe('unit1');
    expect(JSON.parse(fetcher.mock.calls[0][1].body).service_lines[0].client_key).toBe('a');
  });
});
