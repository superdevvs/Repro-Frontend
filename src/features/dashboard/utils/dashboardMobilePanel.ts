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

/** Sticky chrome around mobile section-tab pills (Admin / EM / RoleDashboard). */
export const DASHBOARD_MOBILE_SECTION_TABS_STICKY_CLASS =
  'sticky top-[-0.375rem] -mt-1.5 pt-1.5 z-20 pb-0.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80';
/** Tabs root — half the prior space-y-2 between pill row and panel (8px → 4px). */
export const DASHBOARD_MOBILE_SECTION_TABS_CLASS =
  'flex min-h-0 flex-1 flex-col space-y-1 overflow-hidden dashboard-mobile-tabs';
/** Panel wrapper under section tabs — half the prior pt-1 (4px → 2px). */
export const DASHBOARD_MOBILE_SECTION_PANEL_INNER_CLASS =
  'flex min-h-0 flex-1 flex-col overflow-hidden pt-0.5';

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

/** Desktop Upcoming / EM shoots list: show about this many ShootCards before inner scroll. */
export const UPCOMING_SHOOT_LIST_PEEK_COUNT = 10;

/** Tailwind `space-y-3` between cards inside a day group. */
export const UPCOMING_SHOOT_CARD_GAP_PX = 12;

/**
 * Unmeasured desktop fallback only: a full ShootCard with date badge, address,
 * service tags and weather. Not applied as a floor on live measurements — an
 * oversized floor makes peek maxHeight tall enough to fit ~14 shorter cards.
 */
export const UPCOMING_SHOOT_CARD_MIN_HEIGHT_PX = 172;

function cardOffsetWithinContainer(container: HTMLElement, el: HTMLElement) {
  const cRect = container.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  return {
    top: eRect.top - cRect.top + container.scrollTop,
    bottom: eRect.bottom - cRect.top + container.scrollTop,
    height: eRect.height,
  };
}

/**
 * Pixel height that reveals `peekCount` ShootCards (tags/weather included),
 * plus intervening day-pill chrome and `space-y-3` gaps.
 *
 * Prefer the geometric span of the first N mounted cards when available so
 * sticky day pills between groups count. Otherwise extrapolate from the
 * tallest measured card (floored to a full-card minimum).
 */
export function measureShootListPeekHeightPx(
  container: HTMLElement,
  peekCount: number = UPCOMING_SHOOT_LIST_PEEK_COUNT,
): { peekHeightPx: number; itemHeightPx: number } | null {
  if (peekCount <= 0) return null;

  const cards = Array.from(
    container.querySelectorAll<HTMLElement>('[data-shoot-card="true"]'),
  )
    .map((el) => ({ el, ...cardOffsetWithinContainer(container, el) }))
    .filter((card) => card.height > 0);

  if (cards.length === 0) return null;

  const tallest = Math.max(...cards.map((card) => card.height));
  // Use the tallest mounted card so wrapped tags / weather chips are included.
  const itemHeightPx = tallest;

  if (cards.length >= peekCount) {
    // Content y=0 → bottom of Nth card includes leading sticky day pill(s).
    return {
      peekHeightPx: Math.ceil(cards[peekCount - 1].bottom),
      itemHeightPx,
    };
  }

  let gapPx = UPCOMING_SHOOT_CARD_GAP_PX;
  if (cards.length >= 2) {
    gapPx = Math.max(0, cards[1].top - cards[0].bottom);
  }
  const leadingChromePx = Math.max(0, cards[0].top);
  return {
    peekHeightPx: Math.ceil(
      leadingChromePx + itemHeightPx * peekCount + gapPx * (peekCount - 1),
    ),
    itemHeightPx,
  };
}
