import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contextualSearch } from '@/services/contextualSearch';
import { contextualSearchQueryOptions } from './searchQueryOptions';

vi.mock('@/services/contextualSearch', () => ({ contextualSearch: { search: vi.fn() } }));
afterEach(() => vi.resetAllMocks());

describe('shared search requests', () => {
  it('reuses a panel response on the results page and normalizes surrounding spaces', async () => {
    vi.mocked(contextualSearch.search).mockResolvedValue({ groups: [] });
    const client = new QueryClient();
    await client.fetchQuery(contextualSearchQueryOptions('admin:1', 'everywhere', ' 1447 '));
    await client.fetchQuery(contextualSearchQueryOptions('admin:1', 'everywhere', '1447'));
    expect(contextualSearch.search).toHaveBeenCalledTimes(1);
    client.clear();
  });

  it('isolates identities, scopes, filters and pages', async () => {
    vi.mocked(contextualSearch.search).mockResolvedValue({ groups: [] });
    const client = new QueryClient();
    for (const options of [
      contextualSearchQueryOptions('admin:1', 'shoots', '1447'),
      contextualSearchQueryOptions('client:2', 'shoots', '1447'),
      contextualSearchQueryOptions('admin:1', 'accounts', '1447'),
      contextualSearchQueryOptions('admin:1', 'shoots', '1447', { status: 'scheduled' }),
      contextualSearchQueryOptions('admin:1', 'shoots', '1447', {}, 2),
    ]) await client.fetchQuery(options);
    expect(contextualSearch.search).toHaveBeenCalledTimes(5);
    client.clear();
  });

  it('retries incomplete responses on the next search instead of caching provider failures', async () => {
    vi.mocked(contextualSearch.search).mockResolvedValue({ groups: [{ scope: 'shoots', label: 'Shoots', results: [], hasMore: false, error: 'unavailable' }] });
    const client = new QueryClient();
    await client.fetchQuery(contextualSearchQueryOptions('admin:1', 'everywhere', '1447'));
    await client.fetchQuery(contextualSearchQueryOptions('admin:1', 'everywhere', '1447'));
    expect(contextualSearch.search).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('aborts the transport when a superseded query loses its last observer', async () => {
    let signal: AbortSignal | undefined;
    vi.mocked(contextualSearch.search).mockImplementation((_scope, _q, _filters, _page, requestSignal) => {
      signal = requestSignal;
      return new Promise(() => {});
    });
    const client = new QueryClient();
    const observer = new QueryObserver(client, contextualSearchQueryOptions('admin:1', 'everywhere', '144'));
    const unsubscribe = observer.subscribe(() => {});
    expect(signal?.aborted).toBe(false);
    unsubscribe();
    expect(signal?.aborted).toBe(true);
    client.clear();
  });
});
