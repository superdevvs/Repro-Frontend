import type { MediaFile } from '@/hooks/useShootFiles';

export type MediaSortOrder = 'name' | 'date' | 'time' | 'manual';

/**
 * Capture time: the order the property was actually shot in, which is the order
 * that reads as a walkthrough. Also the order manual sort falls back to when a
 * shoot has no saved arrangement.
 */
export const DEFAULT_MEDIA_SORT: Exclude<MediaSortOrder, 'manual'> = 'time';

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

/** Backend writes sort_order 1-based, so 0 or null means "never placed". */
export const hasSavedManualOrder = (files: MediaFile[]): boolean =>
  files.some((file) => (file.sort_order ?? 0) > 0);

const compareIdsAscending = (left: string, right: string) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, undefined, { numeric: true });
};

/**
 * The order manual sort starts from.
 *
 * Deliberately mirrors the backend's delivery order (ShootFile::deliveryOrderKey
 * sorts on `[sort_order > 0 ? 0 : 1, sort_order, id]`) so the arrangement an
 * admin sees here is the arrangement the tour gallery, the ZIP and the MLS
 * export produce. Two consequences fall out of that:
 *
 *  - A previously saved arrangement is restored, which is what makes switching
 *    away to another sort and back non-destructive.
 *  - A file that was never placed carries sort_order 0 and trails the curated
 *    block instead of leading it. Sorting naively on sort_order put every new
 *    upload at the very top, which is what made entering manual sort look like
 *    it had shuffled the grid at random.
 *
 * When nothing has ever been saved this returns exactly the visible order, so
 * choosing Manual on a fresh shoot moves nothing.
 */
export const buildManualBaselineIds = (
  files: MediaFile[],
  visibleSort: Exclude<MediaSortOrder, 'manual'>,
): string[] => {
  const placed = files
    .filter((file) => (file.sort_order ?? 0) > 0)
    .sort((left, right) => {
      const byPosition = (left.sort_order ?? 0) - (right.sort_order ?? 0);
      // A partial reorder can leave duplicate positions; match the backend's
      // `id asc` tie-break so both sides agree.
      return byPosition !== 0 ? byPosition : compareIdsAscending(left.id, right.id);
    });

  const unplaced = sortMediaFiles(
    files.filter((file) => (file.sort_order ?? 0) <= 0),
    visibleSort,
  );

  return normalizeManualOrder([...placed, ...unplaced].map((file) => file.id), files);
};
