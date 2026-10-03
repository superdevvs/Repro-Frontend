import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardSectionError, readDashboardSection } from './readDashboardSection';

afterEach(() => vi.restoreAllMocks());
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('dashboard section refresh', () => {
  it('retries only the failed page with bounded attempts and preserves earlier records', async () => {
    let laterAttempts = 0;
    const read = vi.fn(async (page: number) => page === 1 ? response({ data: [1], meta: { last_page: 2 } })
      : ++laterAttempts < 3 ? response({}, 503) : response({ data: [2] }));
    expect(await readDashboardSection('completed', read, { page: 1, allPages: true })).toMatchObject({ data: [1, 2] });
    expect(read.mock.calls.map(([page]) => page)).toEqual([1, 2, 2, 2]);
  });
  it('identifies exhausted section and page without exposing server errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const read = vi.fn(async () => response({ error: 'private database details' }, 500));
    const failure = await readDashboardSection('scheduled', read, { page: 3, allPages: true }).catch(error => error);
    expect(failure).toBeInstanceOf(DashboardSectionError);
    expect(failure).toMatchObject({ section: 'scheduled', page: 3, status: 500 });
    expect(failure.message).not.toContain('database');
    expect(read).toHaveBeenCalledTimes(3);
  });
  it('never retries cancellation or expired authentication', async () => {
    const controller = new AbortController();
    const read = vi.fn(async () => { controller.abort(); return response({ data: [1] }); });
    await expect(readDashboardSection('completed', read, { page: 1, allPages: true, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(read).toHaveBeenCalledOnce();
    const unauthorized = vi.fn(async () => response({}, 401));
    await expect(readDashboardSection('completed', unauthorized, { page: 1, allPages: true })).rejects.toThrow('Unauthorized');
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});
