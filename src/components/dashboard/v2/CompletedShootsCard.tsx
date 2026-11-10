import { EmptyState } from '@/components/ui/empty-state';
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { DashboardShootSummary } from '@/types/dashboard';
import { Card } from './SharedComponents';
import { cn } from '@/lib/utils';
import { DASHBOARD_MOBILE_PANEL_CLASS } from '@/features/dashboard/utils/dashboardMobilePanel';
import { useMediaQuery } from '@/hooks/use-media-query';
import { DeliveredShootCard } from './DeliveredShootCard';

import { resolveAdaptiveDeliveredVisibleCount } from './resolveAdaptiveDeliveredVisibleCount';

const DELIVERED_CARD_GAP_PX = 12;
const DELIVERED_MIN_VISIBLE = 2;
const DELIVERED_PREFERRED_VISIBLE = 3;


interface CompletedShootsCardProps {
  shoots: DashboardShootSummary[];
  title?: string;
  subtitle?: string;
  emptyStateText?: string;
  ctaLabel?: string;
  stretch?: boolean;
  /** Paid/Unpaid overlay for admin/salesRep/client (History gate). */
  showPaymentStatus?: boolean;
  onSelect?: (shoot: DashboardShootSummary) => void;
  onViewInvoice?: (shoot: DashboardShootSummary) => void;
  onViewAll?: () => void;
}

export const CompletedShootsCard: React.FC<CompletedShootsCardProps> = ({
  shoots = [],
  title = 'Delivered shoots',
  subtitle = '',
  emptyStateText = 'No delivered shoots yet.',
  ctaLabel = 'View all delivered shoots',
  stretch = false,
  showPaymentStatus = false,
  onSelect,
  onViewInvoice,
  onViewAll,
}) => {
  const safeShoots = Array.isArray(shoots) ? shoots : [];
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [visibleCount, setVisibleCount] = useState(DELIVERED_PREFERRED_VISIBLE);
  // Compact/mobile dashboard tabs: mount every delivery and scroll inside the
  // panel. The adaptive slice (min 2 / preferred 3) was clipping the Completed
  // tab to ~2 cards because the measured list height only fit that many.
  const isCompactDashboardViewport = useMediaQuery('(max-width: 1024px)');

  useLayoutEffect(() => {
    if (isCompactDashboardViewport) return;
    const list = listRef.current;
    const root = rootRef.current;
    if (!list) return;

    const measure = () => {
      // Prefer the flex-1 list box; fall back to root so collapse/stretch
      // transitions that grow the sidebar still retrigger visible-count math.
      setListHeight(list.clientHeight || root?.clientHeight || 0);
      const firstCard = list.querySelector<HTMLElement>('[data-delivered-shoot-card="true"]');
      if (firstCard && firstCard.offsetHeight > 0) {
        setCardHeight(firstCard.offsetHeight);
      }
    };

    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    if (root) observer.observe(root);
    const firstCard = list.querySelector<HTMLElement>('[data-delivered-shoot-card="true"]');
    if (firstCard) observer.observe(firstCard);
    return () => observer.disconnect();
  }, [safeShoots.length, stretch, isCompactDashboardViewport]);

  useEffect(() => {
    if (isCompactDashboardViewport) {
      setVisibleCount(safeShoots.length);
      return;
    }
    setVisibleCount(
      resolveAdaptiveDeliveredVisibleCount({
        availableHeight: listHeight,
        itemHeight: cardHeight,
        totalItems: safeShoots.length,
        gapPx: DELIVERED_CARD_GAP_PX,
        minVisible: DELIVERED_MIN_VISIBLE,
        preferredVisible: DELIVERED_PREFERRED_VISIBLE,
      }),
    );
  }, [listHeight, cardHeight, safeShoots.length, isCompactDashboardViewport]);

  const visibleShoots = useMemo(
    () => (isCompactDashboardViewport ? safeShoots : safeShoots.slice(0, visibleCount)),
    [safeShoots, visibleCount, isCompactDashboardViewport],
  );

  return (
    <Card
      ref={rootRef}
      className={cn(
      DASHBOARD_MOBILE_PANEL_CLASS,
      stretch ? "flex h-full flex-1 min-h-0 flex-col overflow-hidden" : "flex flex-col min-h-0 overflow-hidden",
    )}>
      <div className={cn('flex items-center justify-between shrink-0', subtitle ? 'mb-1.5 sm:mb-4' : 'mb-1.5 sm:mb-3')}>
        <div className="min-w-0">
          <h2 className="hidden text-base font-bold text-foreground sm:block sm:text-lg">{title}</h2>
          {subtitle ? (
            <p className="hidden text-xs text-muted-foreground sm:block">{subtitle}</p>
          ) : null}
        </div>
        <span className="hidden text-xs text-muted-foreground shrink-0 sm:inline">{safeShoots.length} ready</span>
      </div>
      {safeShoots.length === 0 ? (
        <EmptyState icon="completed" title={emptyStateText} description="Completed work will appear here when it is ready." className="flex-1" />
      ) : (
        <div
          ref={listRef}
          className="space-y-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1"
        >
          {visibleShoots.map((shoot) => (
            <DeliveredShootCard
              key={shoot.id}
              shoot={shoot}
              showPaymentStatus={showPaymentStatus}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
      <button
        className="mt-1.5 w-full shrink-0 py-2 sm:mt-2 sm:py-2.5 rounded-2xl border border-border hover:border-primary/40 text-xs font-semibold text-muted-foreground transition-colors"
        onClick={onViewAll}
      >
        {ctaLabel}
      </button>
    </Card>
  );
};
