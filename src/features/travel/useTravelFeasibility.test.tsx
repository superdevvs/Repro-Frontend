import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTravelFeasibility } from './useTravelFeasibility';
import type { TravelFeasibility } from './types';

const available: TravelFeasibility = { enabled: true, status: 'available', available: true, reason_codes: [], transitions: [], alternatives: [], can_override: false, policy_version: '1', schedule_version: '1' };
const conflict = { ...available, status: 'conflict' as const, available: false, can_override: true, confirmation_version: 'evaluated-itinerary-v1', reason_codes: ['insufficient_travel_time'] };
const payload = { client_id: 2, address: '1 Main St', scheduled_at: '2026-10-05T13:00:00Z', photographer_id: 9 };
const response = (value = available, status = 200) => new Response(JSON.stringify({ data: value }), { status });
const tick = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(350); }); };
beforeEach(() => { vi.useFakeTimers(); localStorage.setItem('authToken', 'test'); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('selected itinerary travel preview', () => {
  it.each([
    { status: 422, body: { errors: { property_details: ['The property details field must be an array.'] } }, message: 'property details: The property details field must be an array.' },
    { status: 401, body: { message: 'Unauthenticated.' }, message: 'Your session has expired.' },
    { status: 403, body: { message: 'Forbidden' }, message: 'permission to check this schedule' },
    { status: 429, body: { retry_after: 30 }, message: 'Too many travel checks. Try again in 30 seconds.' },
    { status: 503, body: { message: 'Temporary error' }, retry: '1', message: 'server error 503). Try again in 1 second.' },
    { status: 500, body: { message: 'Internal database path' }, message: 'server error 500' },
  ])('shows actionable HTTP$status request failures and stays blocked', async ({ status, body, retry, message }) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status, headers: retry ? { 'Retry-After': retry } : {} })));
    const { result } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    await tick(); expect(result.current.error).toContain(message); expect(result.current.result).toBeNull();
    expect(result.current.blocked).toBe(true); expect(await result.current.confirmSave()).toBeNull();
    expect(result.current.error).not.toContain('Internal database path');
  });
  it('distinguishes a non-JSON server failure and network failure without exposing response markup', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('<html>proxy error</html>', { status: 502 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch')));
    const { result } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    await tick(); expect(result.current.error).toContain('server error 502'); expect(result.current.blocked).toBe(true);
    await act(async () => result.current.retry());
    expect(result.current.error).toContain('Could not reach the travel check'); expect(result.current.blocked).toBe(true);
  });
  it.each([422, 409])('retains the signed structured HTTP%s conflict as a scheduling result', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ feasibility: conflict }), { status })));
    const { result } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    await tick(); expect(result.current.result).toEqual(conflict); expect(result.current.error).toBeNull();
    expect(result.current.canOverride).toBe(true); expect(result.current.blocked).toBe(false);
  });
  it.each(['itinerary', 'retry', 'server'] as const)('invalidates the separate warning confirmation after %s changes', async change => {
    const force = { ...conflict, can_override: false, can_force_save: true, force_save_confirmation_version: 'force-v1', reason_codes: ['outside_working_hours'] };
    vi.stubGlobal('fetch', vi.fn(async () => response(force)));
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload: { ...payload, shoot_id: 2379, action_mode: 'update' } } });
    await tick(); expect(result.current.blocked).toBe(true); expect(result.current.canForceSave).toBe(true);
    expect(await result.current.confirmSave()).toBeNull();
    const saved = vi.fn(); act(() => { void result.current.confirmForceSave().then(saved); });
    act(() => result.current.forceSaveDialog.setReason('Confirmed package change with photographer'));
    const complete = result.current.forceSaveDialog.complete;
    await act(async () => {
      if (change === 'itinerary') rerender({ payload: { ...payload, shoot_id: 2379, action_mode: 'update', scheduled_at: '2026-10-05T15:00:00Z' } });
      if (change === 'retry') await result.current.retry();
      if (change === 'server') result.current.acceptServerError({ feasibility: { ...force, force_save_confirmation_version: 'force-v2' } });
    });
    act(complete);
    expect(saved).toHaveBeenCalledExactlyOnceWith(null); expect(result.current.forceSaveDialog.open).toBe(false);
  });
  it('keeps staff save provisional during the first check and after a failed check until retry succeeds', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(response());
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    expect(result.current.enabled).toBe(false); // Not yet known, not a disabled-policy response.
    expect(result.current.blocked).toBe(true);
    expect(await result.current.confirmSave()).toBeNull();
    await tick();
    expect(result.current.error).toBe('Network unavailable');
    expect(result.current.blocked).toBe(true);
    expect(await result.current.confirmSave()).toBeNull();
    await act(async () => { await result.current.retry(); });
    expect(result.current.blocked).toBe(false);
    expect(await result.current.confirmSave()).toEqual({});
  });
  it('preserves client request intake while the first check is pending or fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));
    const { result } = renderHook(useTravelFeasibility, { initialProps: { payload, requestedOnly: true } });
    expect(result.current.blocked).toBe(false);
    expect(await result.current.confirmSave()).toEqual({});
    await tick();
    expect(result.current.blocked).toBe(false);
    expect(result.current.error).toBe('Network unavailable');
    expect(await result.current.confirmSave()).toEqual({});
  });
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
  it('pauses the real save until deliberate confirmation and consumes it once', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(conflict))));
    const { result } = renderHook(useTravelFeasibility, { initialProps: { payload } });
    await tick(); expect(result.current.blocked).toBe(false);
    const saved = vi.fn();
    act(() => { void result.current.confirmSave().then(saved); });
    expect(await result.current.confirmSave()).toBeNull();
    expect(result.current.overrideDialog.open).toBe(true); expect(saved).not.toHaveBeenCalled();
    act(() => result.current.overrideDialog.setReason('four'));
    act(() => result.current.overrideDialog.complete()); expect(saved).not.toHaveBeenCalled();
    act(() => result.current.overrideDialog.setReason('Building manager confirmed access'));
    await act(async () => { result.current.overrideDialog.complete(); result.current.overrideDialog.complete(); });
    expect(saved).toHaveBeenCalledExactlyOnceWith({ travel_override: true, travel_override_reason: 'Building manager confirmed access', travel_override_confirmed: true, travel_override_confirmation_version: 'evaluated-itinerary-v1' });
    expect(result.current.confirmation).toEqual({}); expect(result.current.overrideDialog.open).toBe(false);
  });
  it('cannot forge an override without server permission, and preserves client request submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response({ ...conflict, can_override: false }))));
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload, requestedOnly: false } });
    await tick(); expect(await result.current.confirmSave()).toBeNull();
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
    expect(result.current.result?.schedule_version).toBe('2'); expect(result.current.blocked).toBe(false);
    rerender({ payload: { ...payload, address: '3 Main St' } }); await tick();
    act(() => { expect(oldHandler({ feasibility: conflict })).toBe(false); });
    expect(result.current.result?.status).toBe('available');
  });
  it.each(['itinerary', 'retry', 'server', 'cancel'] as const)('cancels the pending save after %s changes instead of using stale approval', async change => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(conflict))));
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } }); await tick();
    const saved = vi.fn(); act(() => { void result.current.confirmSave().then(saved); });
    act(() => result.current.overrideDialog.setReason('Coordinated with photographer'));
    const oldComplete = result.current.overrideDialog.complete;
    await act(async () => {
      if (change === 'itinerary') rerender({ payload: { ...payload, scheduled_at: '2026-10-05T15:00:00Z' } });
      if (change === 'retry') await result.current.retry();
      if (change === 'server') result.current.acceptServerError({ feasibility: { ...conflict, schedule_version: 'new' } });
      if (change === 'cancel') result.current.overrideDialog.cancel();
    });
    act(oldComplete);
    expect(saved).toHaveBeenCalledExactlyOnceWith(null); expect(result.current.overrideDialog.open).toBe(false);
  });
  it.each(['capture_overlap', 'outside_working_hours'])('does not offer a confirmation bypass for %s even if a malformed response grants override', async reason => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response({ ...conflict, reason_codes: [reason] }))));
    const { result } = renderHook(useTravelFeasibility, { initialProps: { payload } }); await tick();
    expect(result.current.blocked).toBe(true); expect(await result.current.confirmSave()).toBeNull(); expect(result.current.overrideDialog.open).toBe(false);
  });
  it('keeps the legacy flow when disabled and never treats network failure as a successful check', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ ...available, enabled: false })).mockRejectedValueOnce(new Error('Network unavailable'));
    vi.stubGlobal('fetch', fetcher);
    const { result, rerender } = renderHook(useTravelFeasibility, { initialProps: { payload } }); await tick();
    expect(result.current.visible).toBe(false); expect(result.current.blocked).toBe(false);
    expect(await result.current.confirmSave()).toEqual({});
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
