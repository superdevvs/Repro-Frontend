export const DASHBOARD_MOBILE_PANEL_CLASS = 'dashboard-mobile-panel';

export function resolveDashboardListMaxHeight({
  compactViewport,
  itemHeight,
  visibleCount,
  gapPx = 12,
  extraPx = 40,
  unmeasuredFallback,
}: {
  compactViewport: boolean;
  itemHeight: number;
  visibleCount: number;
  gapPx?: number;
  extraPx?: number;
  unmeasuredFallback?: string;
}): string | undefined {
  if (compactViewport) {
    return undefined;
  }

  if (itemHeight <= 0) {
    return unmeasuredFallback;
  }

  const gaps = Math.max(0, Math.ceil(visibleCount) - 1);
  return `${Math.ceil(itemHeight * visibleCount + gapPx * gaps + extraPx)}px`;
}
