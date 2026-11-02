import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSchedulingPhotographers } from './schedulingPhotographers';
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer token', 'X-Impersonate-User-Id': '1080' }) }));
afterEach(() => vi.unstubAllGlobals());
describe('scheduling photographer directory', () => {
  it('uses the authenticated scheduling directory and exposes only picker fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 1136, name: 'Delmar', avatar: '/avatar.jpg', email: 'photo@example.test', address: 'Private address', payout: 100 }] })));
    vi.stubGlobal('fetch', fetcher);
    expect(await loadSchedulingPhotographers()).toEqual([{ id: '1136', name: 'Delmar', avatar: '/avatar.jpg', email: 'photo@example.test' }]);
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/api\/photographers$/), expect.objectContaining({ headers: expect.objectContaining({ 'X-Impersonate-User-Id': '1080' }) }));
  });
  it('reports a denied directory lookup instead of returning an empty roster or trying admin endpoints', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadSchedulingPhotographers()).rejects.toThrow('Unable to load photographers');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([null, { name: 'Missing id' }, { id: 1136 }, { id: 'undefined', name: 'Invalid id' }])('rejects malformed directory entries: %s', async person => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [person] }))));
    await expect(loadSchedulingPhotographers()).rejects.toThrow('Unable to load photographers');
  });
});
