import type { MediaFile } from '@/hooks/useShootFiles';

export type MediaSortOrder = 'name' | 'date' | 'time' | 'manual';

/**
 * Where the per-shoot sort choice is remembered.
 *
 * Shared rather than duplicated because the Bright MLS export reads the same
 * preference to order its photos: if the two disagreed, the export would come
 * out in a different order from the grid the user arranged.
 *
 * The `v2` suffix retires the pre-capture-time default. The old default was file
 * name, so nearly every stored value was `name` by inheritance rather than by
 * choice, and reusing the key would have pinned existing users to it.
 */
export const mediaSortStorageKey = (shootId: string | number) => `media-sort-v2-${shootId}`;

const compareStrings = (left?: string, right?: string) => (left || '').localeCompare(right || '');

/**
 * Compare filenames the way a person reads them, so `IMG_2` precedes `IMG_10`.
 *
 * Plain `localeCompare` is lexicographic, which interleaves shot sequences
 * (`_1, _10, _11, _2`) and makes a delivered set look shuffled. Numeric
 * collation keeps the camera's counter in order regardless of zero-padding.
 */
const compareFilenames = (left?: string, right?: string) =>
  (left || '').localeCompare(right || '', undefined, {
    numeric: true,
    sensitivity: 'base',
  });

export const normalizeManualOrder = (manualOrder: string[], files: MediaFile[]): string[] => {
  const fileIds = files.map((file) => file.id);
  const knownIds = new Set(fileIds);
  const seen = new Set<string>();
  const normalized: string[] = [];

  manualOrder.forEach((id) => {
    if (knownIds.has(id) && !seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  });

  fileIds.forEach((id) => {
    if (!seen.has(id)) {
      normalized.push(id);
      seen.add(id);
    }
  });

  return normalized;
};

export const sortMediaFiles = (
  files: MediaFile[],
  sortOrder: MediaSortOrder,
  manualOrder: string[] = [],
): MediaFile[] => {
  if (sortOrder === 'manual') {
    const normalizedOrder = normalizeManualOrder(manualOrder, files);
    const orderMap = new Map(normalizedOrder.map((id, index) => [id, index]));

    return [...files].sort((left, right) => {
      const leftIndex = orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
  }

  return [...files].sort((left, right) => {
    if (sortOrder === 'name') {
      return compareFilenames(left.filename, right.filename);
    }

    if (sortOrder === 'date') {
      return compareStrings(left.created_at, right.created_at);
    }

    // Capture time, the default. A whole folder copied off a card can share one
    // timestamp and `captured_at` is sometimes absent, so ties fall back to the
    // camera's filename counter instead of however the API happened to return
    // them - otherwise equal timestamps look shuffled between refetches.
    const byCaptureTime = compareStrings(
      left.captured_at || left.created_at,
      right.captured_at || right.created_at,
    );

    return byCaptureTime !== 0 ? byCaptureTime : compareFilenames(left.filename, right.filename);
  });
};

export const getSortedMediaIds = (
  files: MediaFile[],
  sortOrder: Exclude<MediaSortOrder, 'manual'>,
): string[] => sortMediaFiles(files, sortOrder).map((file) => file.id);
