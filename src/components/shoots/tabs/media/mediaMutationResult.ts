import type { QueryClient } from '@tanstack/react-query';

export type MediaCountSnapshot = {
  raw_photo_count?: number;
  edited_photo_count?: number;
  extra_photo_count?: number;
  raw_missing_count?: number;
  edited_missing_count?: number;
};

export type MediaMutationResult = {
  media_revision?: number | null;
  counts?: MediaCountSnapshot | null;
  message?: string;
};

export function readMediaRevision(payload: unknown): number | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = Number((payload as { media_revision?: unknown }).media_revision);
  return Number.isFinite(value) ? value : undefined;
}

export function readMediaCounts(payload: unknown): MediaCountSnapshot | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const counts = (payload as { counts?: unknown }).counts;
  if (!counts || typeof counts !== 'object') return undefined;
  return counts as MediaCountSnapshot;
}

/** Invalidate shoot media queries after a mutation; prefer this over optimistic rollback. */
export async function invalidateShootMediaQueries(
  queryClient: QueryClient,
  shootId: string | number,
) {
  for (const tab of ['raw', 'edited', 'all'] as const) {
    await queryClient.invalidateQueries({ queryKey: ['shootFiles', shootId, tab] });
  }
}
