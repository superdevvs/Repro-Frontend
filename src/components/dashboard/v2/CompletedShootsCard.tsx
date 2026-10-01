import { EmptyState } from '@/components/ui/empty-state';
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { DashboardShootSummary } from '@/types/dashboard';
import { Card } from './SharedComponents';
import { cn } from '@/lib/utils';
import { formatDashboardShootSchedule } from '@/utils/dashboardShootSchedule';
import { DASHBOARD_MOBILE_PANEL_CLASS } from '@/features/dashboard/utils/dashboardMobilePanel';
import { useMediaQuery } from '@/hooks/use-media-query';
import { selectShootCardHeroUrls } from '@/utils/shootCardHero';
import { ClientPaymentPill } from '@/features/dashboard/components/ClientPaymentPill';

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

const getShootImages = (shoot: DashboardShootSummary): string[] =>
  selectShootCardHeroUrls(shoot, {
    limit: 6,
    placeholder: '/no-image-placeholder.svg',
  });

interface SlideshowProps {
  images: string[];
  shootId: number;
  addressLine: string;
  clientName: string | null;
  startTime: string | null;
  scheduledLocalDate?: string | null;
  timeLabel?: string | null;
}

const Slideshow: React.FC<SlideshowProps> = ({ images, shootId, addressLine, clientName, startTime, scheduledLocalDate, timeLabel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const scheduleLabel = formatDashboardShootSchedule({ startTime, scheduledLocalDate, timeLabel });

  useEffect(() => {
    if (images.length <= 1 || isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, [images.length, isPaused]);


  return (
    <div
      className="relative h-36 sm:h-56 w-full overflow-hidden group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <img
        src={images[currentIndex]}
        alt={addressLine}
        className="h-full w-full object-cover transition-opacity duration-500"
        loading="lazy"
      />
      {/* Dark gradient from bottom for text readability */}
      <div 
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 15%, rgba(0, 0, 0, 0.6) 30%, rgba(0, 0, 0, 0.3) 45%, rgba(0, 0, 0, 0) 55%)'
        }}
      />
      
      {/* Text content */}
      <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 right-3 sm:right-4 text-white space-y-1 z-10">
        <p className="select-text cursor-text text-xs sm:text-sm font-semibold truncate">{addressLine}</p>
        <div className="text-[10px] sm:text-[11px] text-white/80 flex flex-col">
          <span>{clientName || 'Client TBD'}</span>
          {scheduleLabel && (
            <span className="text-white/60">
              {scheduleLabel}
            </span>
          )}
        </div>
      </div>
      
      {/* Dots indicator in bottom right corner */}
      {images.length > 1 && (
        <div className="absolute bottom-3 right-3 z-20">
          <div className="flex gap-1.5 items-center bg-black/30 backdrop-blur-sm px-2 py-1.5 rounded-full">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
          {visibleShoots.map((shoot) => {
            const images = getShootImages(shoot);
            const scheduleLabel = formatDashboardShootSchedule(shoot);
            return (
              <div
                key={shoot.id}
                data-delivered-shoot-card="true"
                className="rounded-3xl border border-border/60 overflow-hidden hover:border-primary/40 transition-colors bg-card group relative cursor-pointer"
                onClick={() => onSelect?.(shoot)}
              >
                <div className="relative h-36 sm:h-56 w-full overflow-hidden">
                  <img
                    src={images[0]}
                    alt={shoot.addressLine}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div 
                    className="absolute inset-0 pointer-events-none z-[5]"
                    style={{
                      background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.8) 15%, rgba(0, 0, 0, 0.6) 30%, rgba(0, 0, 0, 0.3) 45%, rgba(0, 0, 0, 0) 55%)'
                    }}
                  />
                  <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 right-14 sm:right-16 text-white space-y-1 z-10">
                    <p className="select-text cursor-text text-xs sm:text-sm font-semibold truncate">{shoot.addressLine}</p>
                    <div className="text-[10px] sm:text-[11px] text-white/80 flex flex-col">
                      <span>{shoot.clientName || 'Client TBD'}</span>
                      {scheduleLabel && (
                        <span className="text-white/60">
                          {scheduleLabel}
                        </span>
                      )}
                    </div>
                  </div>
                  {showPaymentStatus ? (
                    <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 pointer-events-none">
                      <ClientPaymentPill status={shoot.paymentStatus} overlay />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
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
