export const DASHBOARD_MOBILE_PAGE_CLASS = 'dashboard-mobile-page';
export const DASHBOARD_MOBILE_PANEL_CLASS = 'dashboard-mobile-panel';
export const DASHBOARD_MOBILE_LIST_SHELL_CLASS = 'dashboard-mobile-list-shell';
/** Compact pages inherit DashboardLayout's 12px sides — same as Availability. */
export const DASHBOARD_COMPACT_PAGE_X_CLASS = 'px-0';
/** Scroll the compact tab pills inside this row — never the page. */
export const DASHBOARD_MOBILE_TAB_ROW_CLASS =
  'min-w-0 max-w-full overflow-x-auto overscroll-x-contain hidden-scrollbar';
export const DASHBOARD_MOBILE_TAB_LIST_CLASS =
  'inline-flex h-auto w-max max-w-none gap-2 rounded-full border border-border/50 pl-1.5 pr-3 py-1.5';
export const DASHBOARD_MOBILE_TAB_TRIGGER_CLASS =
  'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold tracking-tight transition-all duration-150 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:text-muted-foreground/80';

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
