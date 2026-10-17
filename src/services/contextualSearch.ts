import { apiClient } from '@/services/api';
import type { SearchResponse, SearchResult, SearchScope } from '@/components/search/searchTypes';

export const contextualSearch = {
  async scopes(signal?: AbortSignal): Promise<{ enabled: boolean; scopes: SearchScope[] }> {
    return (await apiClient.get('/search/scopes', { signal })).data;
  },
  async search(scope: string, q: string, filters: Record<string, unknown> = {}, page = 1, signal?: AbortSignal): Promise<SearchResponse> {
    return (await apiClient.get('/search', { params: { scope, q, filters: JSON.stringify(filters), page }, signal })).data;
  },
  async preview(scope: string, id: string, q: string, filters: Record<string, unknown>, signal?: AbortSignal): Promise<SearchResult> {
    return (await apiClient.get(`/search/${encodeURIComponent(scope)}/${encodeURIComponent(id)}/preview`, {
      params: { q, filters: JSON.stringify(filters) }, signal,
    })).data.data;
  },
};
