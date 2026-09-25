import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const identity = vi.hoisted(() => ({ impersonatedUser: '' }));
vi.mock('./api', () => ({
  getApiHeaders: () => ({ Accept: 'application/json', 'X-Impersonate-User-Id': identity.impersonatedUser }),
}));

const ok = (id = 'insight') => new Response(JSON.stringify({
  success: true, insights: [{ id, priority: 'attention', message: 'Review shoots', prompt: 'Review' }],
}), { status: 200 });

describe('Robbie insights polling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem('authToken', 'current-token');
    identity.impersonatedUser = '';
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('shares in-flight and cached requests across repeated mounts and refreshes after one minute', async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r; })).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetch);
    const { fetchRobbieInsights, INSIGHTS_REFRESH_MS } = await import('./robbieInsightsService');
    const first = fetchRobbieInsights();
    const second = fetchRobbieInsights();
    expect(fetch).toHaveBeenCalledOnce();
    resolve(ok());
    expect(await first).toEqual(await second);
    await fetchRobbieInsights();
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(INSIGHTS_REFRESH_MS);
    await fetchRobbieInsights();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([401, 419])('stops polling rejected credentials (%s) and recovers with the current stored token', async (status) => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetch);
    const { fetchRobbieInsights } = await import('./robbieInsightsService');
    expect((await fetchRobbieInsights()).error).toContain('Sign in again');
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await fetchRobbieInsights();
    expect(fetch).toHaveBeenCalledOnce();
    localStorage.setItem('authToken', 'replacement-token');
    expect((await fetchRobbieInsights()).error).toBeNull();
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer replacement-token');
  });

  it('does not share one impersonated account response with another or retain data after logout', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok('first-account')).mockResolvedValueOnce(ok('second-account'));
    vi.stubGlobal('fetch', fetch);
    const { fetchRobbieInsights } = await import('./robbieInsightsService');
    identity.impersonatedUser = '100';
    expect((await fetchRobbieInsights()).insights[0].id).toBe('first-account');
    identity.impersonatedUser = '200';
    expect((await fetchRobbieInsights()).insights[0].id).toBe('second-account');
    localStorage.clear();
    expect(await fetchRobbieInsights()).toEqual({ insights: [], error: null });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('backs off temporary errors instead of retrying on every mount', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok());
    vi.stubGlobal('fetch', fetch);
    const { fetchRobbieInsights, INSIGHTS_REFRESH_MS } = await import('./robbieInsightsService');
    expect((await fetchRobbieInsights()).error).toBeTruthy();
    await fetchRobbieInsights();
    expect(fetch).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(INSIGHTS_REFRESH_MS);
    expect((await fetchRobbieInsights()).error).toBeNull();
  });
});
