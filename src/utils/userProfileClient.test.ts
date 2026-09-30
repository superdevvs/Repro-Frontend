import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  USER_PROFILE_LAST_FETCH_KEY,
  USER_PROFILE_MIN_INTERVAL_MS,
  fetchCurrentUserProfile,
  resetUserProfileClientState,
} from './userProfileClient';

describe('fetchCurrentUserProfile', () => {
  beforeEach(() => {
    resetUserProfileClientState();
    localStorage.clear();
    localStorage.setItem('authToken', 'tok');
  });
  afterEach(() => {
    resetUserProfileClientState();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('singleflights concurrent callers and floors automatic refetches for 60s', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );

    const a = fetchCurrentUserProfile({ fetchImpl: fetchImpl as unknown as typeof fetch, now: 1_000 });
    const b = fetchCurrentUserProfile({ fetchImpl: fetchImpl as unknown as typeof fetch, now: 1_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({ id: 1388, email_verification: { verified: true } }),
    } as unknown as Response);

    await expect(a).resolves.toMatchObject({ id: 1388 });
    await expect(b).resolves.toMatchObject({ id: 1388 });
    expect(localStorage.getItem(USER_PROFILE_LAST_FETCH_KEY)).toBe('1000');

    const skipped = await fetchCurrentUserProfile({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: 1_000 + USER_PROFILE_MIN_INTERVAL_MS - 1,
    });
    expect(skipped).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
