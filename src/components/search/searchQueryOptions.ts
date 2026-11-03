import { queryOptions } from '@tanstack/react-query';
import { contextualSearch } from '@/services/contextualSearch';

/** The panel and full results page share one short-lived, identity-scoped request. */
export function contextualSearchQueryOptions(
  identity: string,
  scope: string,
  query: string,
  filters: Record<string, unknown> = {},
  page = 1,
) {
  const term = query.trim();
  return queryOptions({
    queryKey: ['contextual-search', identity, scope, term, filters, page],
    queryFn: ({ signal }) => contextualSearch.search(scope, term, filters, page, signal),
    staleTime: query => query.state.data?.groups.some(group => group.error) ? 0 : 30_000,
    gcTime: 60_000,
    retry: false,
  });
}
