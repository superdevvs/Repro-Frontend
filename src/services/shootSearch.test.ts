import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';
import { searchShoots, shouldRequestShootSearch } from './shootSearch';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/api', () => ({ apiClient: { get } }));

afterEach(() => {
  vi.clearAllMocks();
});

const apiShoot = (id: number | string, overrides: Record<string, unknown> = {}) => ({
  id,
  status: 'scheduled',
  workflow_status: 'scheduled',
  address: `Address ${id}`,
  client: { id: 10, name: 'Acme Realty', company: 'Acme' },
  photographer: { id: 20, name: 'Pat Photographer' },
  ...overrides,
});

describe('shouldRequestShootSearch', () => {
  it('skips empty and whitespace-only terms', () => {
    expect(shouldRequestShootSearch('')).toBe(false);
    expect(shouldRequestShootSearch('   ')).toBe(false);
    expect(shouldRequestShootSearch('\t\n')).toBe(false);
  });

  it('allows non-empty terms', () => {
    expect(shouldRequestShootSearch('123')).toBe(true);
    expect(shouldRequestShootSearch('  main st ')).toBe(true);
  });
});

describe('searchShoots', () => {
  it('calls GET /shoots with tab=all, search (not q), and per_page=20', async () => {
    get.mockResolvedValueOnce({
      data: { data: [apiShoot(42)], meta: { count: 1 } },
    });

    const result = await searchShoots({ search: '42' });

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/shoots', expect.objectContaining({
      params: { tab: 'all', search: '42', per_page: 20 },
    }));
    expect(result.data).toHaveLength(1);
    expect(String(result.data[0].id)).toBe('42');
    expect(result.count).toBe(1);
  });

  it('treats 200 + empty data as a truthful miss using meta.count', async () => {
    get.mockResolvedValueOnce({
      data: { data: [], meta: { count: 0 } },
    });

    const result = await searchShoots({ search: 'zzzz-no-hit' });
    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('rejects blank search instead of issuing a heavy tab=all list request', async () => {
    await expect(searchShoots({ search: '   ' })).rejects.toThrow(/non-empty/i);
    expect(get).not.toHaveBeenCalled();
  });

  it('surfaces transport/HTTP failures as errors (not empty hits)', async () => {
    get.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(searchShoots({ search: 'main' })).rejects.toThrow('Unavailable');
  });

  it('maps list cards role-agnostically via mapShootApiToShootData', async () => {
    const payload = apiShoot('007', {
      client: { id: 99, name: 'Padded Client', company: null },
    });
    get.mockResolvedValueOnce({
      data: { data: [payload], meta: { count: 1 } },
    });

    const result = await searchShoots({ search: '007' });
    const expected = mapShootApiToShootData(payload);
    expect(result.data[0].id).toEqual(expected.id);
    expect(result.data[0].client?.name).toBe(expected.client?.name);
  });

  it('trims the search term before sending', async () => {
    get.mockResolvedValueOnce({ data: { data: [], meta: { count: 0 } } });
    await searchShoots({ search: '  123  ' });
    expect(get).toHaveBeenCalledWith('/shoots', expect.objectContaining({
      params: expect.objectContaining({ search: '123' }),
    }));
  });

  it('forwards AbortSignal to apiClient', async () => {
    const controller = new AbortController();
    get.mockResolvedValueOnce({ data: { data: [], meta: { count: 0 } } });
    await searchShoots({ search: 'main', signal: controller.signal });
    expect(get).toHaveBeenCalledWith('/shoots', expect.objectContaining({
      signal: controller.signal,
    }));
  });
});
