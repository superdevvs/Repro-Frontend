import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IP_LOCATION_CACHE_KEY,
  IP_LOCATION_DEFAULT_BACKOFF_MS,
  IP_LOCATION_MIN_NETWORK_INTERVAL_MS,
  resetIpLocationClientState,
  resolveIpLocation,
  writeCachedIpLocationCoords,
} from './ipLocationClient';

describe('resolveIpLocation', () => {
  beforeEach(() => {
    resetIpLocationClientState();
    localStorage.clear();
  });
  afterEach(() => {
    resetIpLocationClientState();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('returns fresh cache without hitting the network', async () => {
    writeCachedIpLocationCoords({ lat: 40.7, lon: -74.0, label: 'New York, NY' });
    const fetchImpl = vi.fn();
    const result = await resolveIpLocation({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toMatchObject({ lat: 40.7, lon: -74.0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('dedupes concurrent network lookups', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );
    const a = resolveIpLocation({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const b = resolveIpLocation({ fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolveFetch({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ data: { latitude: 1, longitude: 2, city: 'A', region: 'B' } }),
    } as unknown as Response);
    await expect(a).resolves.toMatchObject({ lat: 1, lon: 2 });
    await expect(b).resolves.toMatchObject({ lat: 1, lon: 2 });
    expect(localStorage.getItem(IP_LOCATION_CACHE_KEY)).toContain('"lat":1');
  });

  it('floors empty-cache retries so remount loops cannot hammer', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      headers: { get: () => null },
      json: async () => ({}),
    }) as unknown as Response);
    await resolveIpLocation({ fetchImpl: fetchImpl as unknown as typeof fetch, now: 5_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await resolveIpLocation({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: 5_000 + IP_LOCATION_MIN_NETWORK_INTERVAL_MS - 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('circuit-breaks after 429 so remounts do not storm', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === 'Retry-After' ? '120' : null) },
      json: async () => ({}),
    }) as unknown as Response);

    const first = await resolveIpLocation({ fetchImpl: fetchImpl as unknown as typeof fetch, now: 1_000 });
    expect(first).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const second = await resolveIpLocation({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: 1_000 + IP_LOCATION_DEFAULT_BACKOFF_MS - 1,
    });
    expect(second).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Still inside Retry-After (120s)
    await resolveIpLocation({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: 1_000 + 60_000,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
