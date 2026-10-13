import type { MediaFile } from '@/hooks/useShootFiles';
import { normalizeManualOrder } from './mediaSort';

/** A displayed pane can contain restore-only rows that do not belong to the sortable universe. */
export function mergeMediaContextOrder(manualOrder: string[], sortableFiles: MediaFile[], contextFiles: MediaFile[], nextContextOrder: string[], separateExtras = true) {
  const normalizedGlobalOrder = normalizeManualOrder(manualOrder, sortableFiles);
  const sortableIds = new Set(sortableFiles.map(file => file.id));
  const eligibleContext = contextFiles.filter(file => sortableIds.has(file.id));
  const contextFileMap = new Map(eligibleContext.map(file => [file.id, file]));
  const contextRegularIds = normalizeManualOrder(normalizedGlobalOrder.filter(id => contextFileMap.has(id)), eligibleContext)
    .filter(id => !(separateExtras && contextFileMap.get(id)?.isExtra));
  const visibleReorderedIds = nextContextOrder.filter(id => contextRegularIds.includes(id));
  if (!contextRegularIds.length || !visibleReorderedIds.length) return null;
  const visibleIdSet = new Set(visibleReorderedIds);
  const visibleQueue = [...visibleReorderedIds];
  const reorderedContextIds = contextRegularIds.map(id => visibleIdSet.has(id) ? visibleQueue.shift() || id : id);
  const contextRegularIdSet = new Set(contextRegularIds);
  const reorderedQueue = [...reorderedContextIds];
  return normalizedGlobalOrder.map(id => contextRegularIdSet.has(id) ? reorderedQueue.shift() || id : id);
}
