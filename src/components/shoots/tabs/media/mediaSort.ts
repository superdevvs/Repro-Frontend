import type { MediaFile } from '@/hooks/useShootFiles';

export type MediaSortOrder = 'name' | 'date' | 'time' | 'manual';

const compareStrings = (left?: string, right?: string) => (left || '').localeCompare(right || '');

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
      return compareStrings(left.filename, right.filename);
    }

    if (sortOrder === 'date') {
      return compareStrings(left.created_at, right.created_at);
    }

    return compareStrings(left.captured_at || left.created_at, right.captured_at || right.created_at);
  });
};

export const getSortedMediaIds = (
  files: MediaFile[],
  sortOrder: Exclude<MediaSortOrder, 'manual'>,
): string[] => sortMediaFiles(files, sortOrder).map((file) => file.id);
