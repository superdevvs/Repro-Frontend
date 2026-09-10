import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPublicTourData, usePublicTourData } from './usePublicTourData';
import { trackPageView } from '@/lib/tourTracking';

vi.mock('@/lib/tourTracking', () => ({ trackPageView: vi.fn() }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('public tour loader', () => {
  it('rejects HTTP failures before accepting error JSON as tour content', async () => {
    const json = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json }));
    await expect(loadPublicTourData('/tour', 'mls')).rejects.toThrow('could not be found');
    expect(json).not.toHaveBeenCalled();
  });

  it('reports a retryable service failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { result } = renderHook(() => usePublicTourData({ variant: 'branded', search: '?shootId=7' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('Please try again');
    expect(result.current.data).toBeNull();
  });

  it('keeps missing lookup and fixture previews offline without analytics', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const missing = renderHook(() => usePublicTourData({ variant: 'branded', search: '' }));
    expect(missing.result.current.loading).toBe(false);
    expect(missing.result.current.data?.empty).toBe(true);
    const initialData = { shoot: { id: 77, address: '123 Oak' } };
    const preview = renderHook(() => usePublicTourData({ variant: 'branded', initialData }));
    expect(preview.result.current.data?.shoot?.address).toBe('123 Oak');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(trackPageView).not.toHaveBeenCalled();
  });

  it('loads address-based data and tracks the resolved shoot identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ shoot: { id: 55, address: '123 Oak' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePublicTourData({ variant: 'generic-mls', search: '?address=123+Oak&city=Boston&state=MA' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/g-mls\?address=123\+Oak&city=Boston&state=MA&t=\d+$/);
    expect(trackPageView).toHaveBeenCalledWith(55, 'generic_mls');
    expect(result.current.data?.shoot?.id).toBe(55);
  });

  it('aborts an outdated request and ignores its late resolution after changing property', async () => {
    let resolveFirst: (response: unknown) => void = () => undefined;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ shoot: { id: 2 } }) });
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ search }) => usePublicTourData({ variant: 'mls', search }), { initialProps: { search: '?shootId=1' } });
    rerender({ search: '?shootId=2' });
    await waitFor(() => expect(result.current.data?.shoot?.id).toBe(2));
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { resolveFirst({ ok: true, json: async () => ({ shoot: { id: 1 } }) }); });
    expect(result.current.data?.shoot?.id).toBe(2);
    expect(trackPageView).toHaveBeenCalledTimes(1);
    expect(trackPageView).toHaveBeenCalledWith(2, 'mls');
  });
});
