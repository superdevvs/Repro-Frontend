import { apiClient } from '@/services/api';
import { mapShootApiToShootData } from '@/components/shoots/history/shootHistoryTransforms';
import type { ShootData } from '@/types/shoots';

export const SHOOT_SEARCH_DEFAULT_PER_PAGE = 20;
export const SHOOT_SEARCH_DEBOUNCE_MS = 275;

export type ShootSearchParams = {
  search: string;
  perPage?: number;
  signal?: AbortSignal;
};

export type ShootSearchResult = {
  data: ShootData[];
  /** Prefer BE `meta.count` (not History `meta.total`). */
  count: number;
};

/**
 * Shared "search all shoots" client for Global Command Bar (and any other
 * find-across-shoots UX). Hits the shoot index with tab=all + search.
 *
 * Contract: GET /api/shoots?tab=all&search=TERM&per_page=20
 * - Param name is `search` (not `q`).
 * - Empty/whitespace callers must not invoke this (heavy full list).
 * - 200 + empty `data` is a truthful miss, not an error.
 * - Soft-deleted clients are excluded on BE; mapping is role-agnostic.
 */
export async function searchShoots({
  search,
  perPage = SHOOT_SEARCH_DEFAULT_PER_PAGE,
  signal,
}: ShootSearchParams): Promise<ShootSearchResult> {
  const term = search.trim();
  if (!term) {
    throw new Error('searchShoots requires a non-empty search term');
  }

  const response = await apiClient.get('/shoots', {
    signal,
    params: {
      tab: 'all',
      search: term,
      per_page: perPage,
    },
  });

  const payload = response.data ?? {};
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const data = rows.map((item: Record<string, unknown>) => mapShootApiToShootData(item));
  const meta = payload.meta ?? {};
  const count =
    typeof meta.count === 'number'
      ? meta.count
      : typeof meta.total === 'number'
        ? meta.total
        : data.length;

  return { data, count };
}

/** True when the term should trigger a server search (non-empty after trim). */
export function shouldRequestShootSearch(value: string): boolean {
  return value.trim().length > 0;
}
