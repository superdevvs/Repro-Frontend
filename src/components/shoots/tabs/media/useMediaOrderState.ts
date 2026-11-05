import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import type { MediaFile } from '@/hooks/useShootFiles';
import {
  buildManualBaselineIds,
  DEFAULT_MEDIA_SORT,
  hasSavedManualOrder,
  mediaSortStorageKey,
  normalizeManualOrder,
  type MediaSortOrder,
} from './mediaSort';

function rememberedSort(shootId: string | number): MediaSortOrder {
  try {
    const saved = localStorage.getItem(mediaSortStorageKey(shootId));
    if (saved && ['name', 'date', 'time', 'manual'].includes(saved)) return saved as MediaSortOrder;
  } catch {
    // Server ordering still works when browser storage is unavailable.
  }
  return DEFAULT_MEDIA_SORT;
}

/** Saved positions belong to the shoot; browser sort choices are temporary views of them. */
export function useMediaOrderState(
  shootId: string | number,
  files: MediaFile[],
  pendingManualOrder: RefObject<boolean>,
  preferSavedOrder = false,
) {
  const [remembered] = useState(() => rememberedSort(shootId));
  const [chosenSort, setSortOrder] = useState<MediaSortOrder | null>(null);
  const [manualDraft, setManualOrder] = useState<string[] | null>(null);
  const hasSavedOrder = hasSavedManualOrder(files);
  const isPending = pendingManualOrder.current;

  // A different browser (or an inherited Time preference) must still open the
  // delivered set in its saved arrangement. An explicit selection remains in
  // effect for this open view, without changing the persisted image positions.
  const sortOrder = chosenSort ?? (preferSavedOrder && hasSavedOrder ? 'manual' : remembered);
  const manualOrder = useMemo(() => {
    if (manualDraft !== null && (isPending || !hasSavedOrder)) {
      return normalizeManualOrder(manualDraft, files);
    }
    return buildManualBaselineIds(files, DEFAULT_MEDIA_SORT);
  }, [files, hasSavedOrder, isPending, manualDraft]);
  const acceptSavedOrder = useCallback(() => setManualOrder(null), []);

  useEffect(() => {
    try {
      localStorage.setItem(mediaSortStorageKey(shootId), sortOrder);
    } catch {
      // The sort choice does not require localStorage to work.
    }
  }, [shootId, sortOrder]);

  return { sortOrder, setSortOrder, manualOrder, setManualOrder, acceptSavedOrder };
}
