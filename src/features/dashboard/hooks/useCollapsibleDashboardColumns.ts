import React from "react";

/**
 * Shared logic for the dashboard's collapsible side columns.
 *
 * Originally this behavior lived only in the admin/superadmin dashboard. It
 * provides two things:
 *   1. Manual show/hide toggles for the left and/or right side columns via the
 *      hover handles that sit in the column gaps.
 *   2. An automatic "tight range" behavior: between {@link AUTO_HIDE_MIN_WIDTH}
 *      and {@link AUTO_HIDE_MAX_WIDTH} the layout can only comfortably show one
 *      side column at a time, so it auto-hides the other and lets the user
 *      toggle which one is visible.
 *
 * The hook is generic over which side columns exist so it can also drive
 * layouts that only have a right column (e.g. the editing manager dashboard).
 */
export const AUTO_HIDE_MIN_WIDTH = 1025;
export const AUTO_HIDE_MAX_WIDTH = 1420;

const SETTLE_DURATION_MS = 420;

export interface UseCollapsibleDashboardColumnsOptions {
  /** Whether a left side column exists in the layout. Defaults to true. */
  hasLeftColumn?: boolean;
  /** Whether a right side column exists in the layout. Defaults to true. */
  hasRightColumn?: boolean;
  /** Fixed width (px) of the left side column when visible. Defaults to 320. */
  leftWidth?: number;
  /** Fixed width (px) of the right side column when visible. Defaults to 320. */
  rightWidth?: number;
  /** Gap (px) between the center column and each side column. Defaults to 24. */
  gap?: number;
  /** Viewport width (px) at/above which the desktop grid renders. Defaults to AUTO_HIDE_MIN_WIDTH. */
  desktopMinWidth?: number;
}

export interface UseCollapsibleDashboardColumnsResult {
  /** True when the explicit desktop grid (with collapsible tracks) should render. */
  isDesktopGrid: boolean;
  /** CSS grid-template-columns string for the 5-track collapsible grid. */
  desktopGridTemplateColumns: string;
  /** Effective hidden state of the left column (manual OR auto-range OR absent). */
  effectiveLeftColumnHidden: boolean;
  /** Effective hidden state of the right column (manual OR auto-range OR absent). */
  effectiveRightColumnHidden: boolean;
  /** True while the left handle is briefly hidden after a toggle (animation settle). */
  leftHandleSettling: boolean;
  /** True while the right handle is briefly hidden after a toggle (animation settle). */
  rightHandleSettling: boolean;
  /** Toggle the left column's visibility. */
  toggleLeftColumn: () => void;
  /** Toggle the right column's visibility. */
  toggleRightColumn: () => void;
  /** Current viewport width in px. */
  viewportWidth: number;
}

export function useCollapsibleDashboardColumns(
  options: UseCollapsibleDashboardColumnsOptions = {},
): UseCollapsibleDashboardColumnsResult {
  const {
    hasLeftColumn = true,
    hasRightColumn = true,
    leftWidth = 320,
    rightWidth = 320,
    gap = 24,
    desktopMinWidth = AUTO_HIDE_MIN_WIDTH,
  } = options;

  const [leftColumnHidden, setLeftColumnHidden] = React.useState(false);
  const [rightColumnHidden, setRightColumnHidden] = React.useState(false);
  // Which side column is visible while inside the tight auto-hide range.
  // When both columns exist we default to keeping the right column visible
  // (mirrors the original admin behavior). When only a right column exists we
  // default to hiding it so the wide center column gets maximum room.
  const [autoRangeVisibleColumn, setAutoRangeVisibleColumn] = React.useState<
    "left" | "right" | null
  >(hasLeftColumn ? "right" : null);
  const [leftHandleSettling, setLeftHandleSettling] = React.useState(false);
  const [rightHandleSettling, setRightHandleSettling] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const leftHandleSettleTimerRef = React.useRef<number | null>(null);
  const rightHandleSettleTimerRef = React.useRef<number | null>(null);

  const sideColumnCount = (hasLeftColumn ? 1 : 0) + (hasRightColumn ? 1 : 0);
  const isDesktopGrid = viewportWidth >= desktopMinWidth;
  const shouldAutoHide =
    sideColumnCount > 0 &&
    isDesktopGrid &&
    viewportWidth >= AUTO_HIDE_MIN_WIDTH &&
    viewportWidth <= AUTO_HIDE_MAX_WIDTH;

  const autoRangeLeftColumnHidden =
    shouldAutoHide && hasLeftColumn && autoRangeVisibleColumn !== "left";
  const autoRangeRightColumnHidden =
    shouldAutoHide && hasRightColumn && autoRangeVisibleColumn !== "right";

  const effectiveLeftColumnHidden =
    !hasLeftColumn || leftColumnHidden || autoRangeLeftColumnHidden;
  const effectiveRightColumnHidden =
    !hasRightColumn || rightColumnHidden || autoRangeRightColumnHidden;

  const leftTrack = effectiveLeftColumnHidden ? "0px 0px" : `${leftWidth}px ${gap}px`;
  const rightTrack = effectiveRightColumnHidden ? "0px 0px" : `${gap}px ${rightWidth}px`;
  const desktopGridTemplateColumns = `${leftTrack} minmax(0, 1fr) ${rightTrack}`;

  React.useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (leftHandleSettleTimerRef.current !== null) {
        window.clearTimeout(leftHandleSettleTimerRef.current);
      }
      if (rightHandleSettleTimerRef.current !== null) {
        window.clearTimeout(rightHandleSettleTimerRef.current);
      }
    };
  }, []);

  const toggleLeftColumn = React.useCallback(() => {
    if (!hasLeftColumn) {
      return;
    }
    setLeftHandleSettling(true);
    if (leftHandleSettleTimerRef.current !== null) {
      window.clearTimeout(leftHandleSettleTimerRef.current);
    }
    leftHandleSettleTimerRef.current = window.setTimeout(() => {
      setLeftHandleSettling(false);
      leftHandleSettleTimerRef.current = null;
    }, SETTLE_DURATION_MS);

    if (shouldAutoHide) {
      setAutoRangeVisibleColumn(effectiveLeftColumnHidden ? "left" : null);
      setLeftColumnHidden(false);
      setRightColumnHidden(false);
      return;
    }
    setLeftColumnHidden((hidden) => !hidden);
  }, [effectiveLeftColumnHidden, hasLeftColumn, shouldAutoHide]);

  const toggleRightColumn = React.useCallback(() => {
    if (!hasRightColumn) {
      return;
    }
    setRightHandleSettling(true);
    if (rightHandleSettleTimerRef.current !== null) {
      window.clearTimeout(rightHandleSettleTimerRef.current);
    }
    rightHandleSettleTimerRef.current = window.setTimeout(() => {
      setRightHandleSettling(false);
      rightHandleSettleTimerRef.current = null;
    }, SETTLE_DURATION_MS);

    if (shouldAutoHide) {
      setAutoRangeVisibleColumn(effectiveRightColumnHidden ? "right" : null);
      setLeftColumnHidden(false);
      setRightColumnHidden(false);
      return;
    }
    setRightColumnHidden((hidden) => !hidden);
  }, [effectiveRightColumnHidden, hasRightColumn, shouldAutoHide]);

  return {
    isDesktopGrid,
    desktopGridTemplateColumns,
    effectiveLeftColumnHidden,
    effectiveRightColumnHidden,
    leftHandleSettling,
    rightHandleSettling,
    toggleLeftColumn,
    toggleRightColumn,
    viewportWidth,
  };
}
