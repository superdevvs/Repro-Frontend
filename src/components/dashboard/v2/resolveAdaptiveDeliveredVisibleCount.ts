/** How many delivered shoot cards fit in the sidebar list height. */
export function resolveAdaptiveDeliveredVisibleCount({
  availableHeight,
  itemHeight,
  totalItems,
  gapPx = 12,
  minVisible = 2,
  preferredVisible = 3,
}: {
  availableHeight: number;
  itemHeight: number;
  totalItems: number;
  gapPx?: number;
  minVisible?: number;
  preferredVisible?: number;
}): number {
  const total = Math.max(0, totalItems);
  if (total === 0) return 0;

  const preferred = Math.min(Math.max(preferredVisible, minVisible), total);
  if (availableHeight <= 0 || itemHeight <= 0) {
    return preferred;
  }

  const fitted = Math.floor((availableHeight + gapPx) / (itemHeight + gapPx));
  // Never show fewer than minVisible when items exist (slight scroll OK on short columns).
  // Prefer preferredVisible when that many fit; grow beyond when the column is taller.
  const count = Math.max(minVisible, fitted);
  return Math.min(count, total);
}
