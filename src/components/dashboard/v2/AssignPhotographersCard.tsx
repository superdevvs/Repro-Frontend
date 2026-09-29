import React, { useMemo, useRef, useState, useEffect } from 'react';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronRight, Phone, Mail, MessageSquare, MapPin } from 'lucide-react';
import { DashboardPhotographerSummary } from '@/types/dashboard';
import { Card, Avatar } from './SharedComponents';
import { cn, getInitials } from '@/lib/utils';
import { usePhotographerAssignment } from '@/context/PhotographerAssignmentContext';
import { useMediaQuery } from '@/hooks/use-media-query';
import { DASHBOARD_MOBILE_PANEL_CLASS, resolveDashboardListMaxHeight } from '@/features/dashboard/utils/dashboardMobilePanel';

interface AvailabilityWindow {
  date: string;
  start_time: string;
  end_time: string;
}

interface AssignPhotographersCardProps {
  initialTab?: Tab;
  photographers: DashboardPhotographerSummary[];
  onPhotographerSelect: (photographer: DashboardPhotographerSummary) => void;
  onViewSchedule?: () => void;
  availablePhotographerIds?: number[];
  availabilityWindow?: AvailabilityWindow;
  onAvailabilityWindowChange?: (window: AvailabilityWindow) => void;
  availabilityLoading?: boolean;
  availabilityError?: string | null;
  showContactActions?: boolean;
}

type Tab = 'available' | 'booked' | 'all';
type SortBy = 'availability' | 'load' | 'alpha';
type WindowPreset = 'today' | 'week' | 'month';

const HoverMarqueeText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const containerRef = React.useRef<HTMLSpanElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    const updateScrollDistance = () => {
      const container = containerRef.current;
      const textElement = textRef.current;

      if (!container || !textElement) return;

      const nextDistance = Math.max(textElement.scrollWidth - container.clientWidth, 0);
      setScrollDistance(nextDistance);
    };

    updateScrollDistance();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollDistance) : null;

    if (resizeObserver && containerRef.current && textRef.current) {
      resizeObserver.observe(containerRef.current);
      resizeObserver.observe(textRef.current);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateScrollDistance);
    }

    return () => {
      resizeObserver?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateScrollDistance);
      }
    };
  }, [text]);

  return (
    <span ref={containerRef} className={cn('assign-photographer-name block', className)} title={text}>
      <span
        ref={textRef}
        className={cn(
          'assign-photographer-name__text',
          scrollDistance > 0 && 'assign-photographer-name__text--scroll',
        )}
        style={
          scrollDistance > 0
            ? ({ '--name-scroll-distance': `-${scrollDistance}px` } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
};

export const AssignPhotographersCard: React.FC<AssignPhotographersCardProps> = ({
  initialTab = 'available',
  photographers,
  onPhotographerSelect,
  onViewSchedule,
  availablePhotographerIds = [],
  availabilityWindow,
  onAvailabilityWindowChange,
  availabilityLoading,
  availabilityError,
  showContactActions = false,
}) => {
  const { openModal } = usePhotographerAssignment();
  const sectionGutter = 'px-3 sm:px-5';
  const listGutter = 'px-0.5 sm:px-3';
  const [tab, setTab] = useState<Tab>(initialTab);
  const isCompactDashboardViewport = useMediaQuery('(max-width: 1024px)');
  const [sortBy, setSortBy] = useState<SortBy>('availability');
  const [preset, setPreset] = useState<WindowPreset>('today');
  const availabilitySet = useMemo(() => new Set(availablePhotographerIds), [availablePhotographerIds]);
  // Trust the API response once it has resolved (loading=false, no error), even when the
  // returned list is empty — that legitimately means "no one available in this window".
  // Only fall back to the optimistic "everyone free" view while the request is in flight
  // or errored, so the UI doesn't flash wrong zeros before the first fetch completes.
  const hasAvailabilityData = !availabilityLoading && !availabilityError;

  const handlePhotographerClick = (photographer: DashboardPhotographerSummary) => {
    openModal(photographer);
    onPhotographerSelect(photographer);
  };

  const buildWindow = (value: WindowPreset): AvailabilityWindow => {
    const now = new Date();
    if (value === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 0 });
      return {
        date: format(start, 'yyyy-MM-dd'),
        start_time: '00:00',
        end_time: '23:59',
      };
    }
    if (value === 'month') {
      const start = startOfMonth(now);
      return {
        date: format(start, 'yyyy-MM-dd'),
        start_time: '00:00',
        end_time: '23:59',
      };
    }
    return {
      date: format(now, 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '17:00',
    };
  };

  useEffect(() => {
    if (!availabilityWindow) return;
    // keep preset in sync when external window changes
    if (availabilityWindow.start_time === '00:00' && availabilityWindow.end_time === '23:59') {
      const windowDate = availabilityWindow.date;
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      if (windowDate === weekStart) {
        setPreset('week');
        return;
      }
      if (windowDate === monthStart) {
        setPreset('month');
        return;
      }
    }
    setPreset('today');
  }, [availabilityWindow]);

  const handlePresetChange = (value: WindowPreset) => {
    setPreset(value);
    onAvailabilityWindowChange?.(buildWindow(value));
  };

  const stats = useMemo(() => {
    const available = hasAvailabilityData
      ? photographers.filter((p) => availabilitySet.has(p.id)).length
      : photographers.length;
    const busy = photographers.filter(
      (p) => hasAvailabilityData && !availabilitySet.has(p.id) && ['busy', 'editing'].includes(p.status),
    ).length;
    const offline = Math.max(photographers.length - available - busy, 0);
    return { available, booked: busy, offline };
  }, [photographers, availabilitySet, hasAvailabilityData]);

  // Dynamic max-height so the list reveals ~8 photographer rows at a time, then scrolls.
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState<number>(0);

  const listMaxHeight = useMemo(
    () =>
      resolveDashboardListMaxHeight({
        compactViewport: isCompactDashboardViewport,
        itemHeight: rowHeight,
        visibleCount: 8,
        gapPx: 8,
        extraPx: 24,
      }),
    [isCompactDashboardViewport, rowHeight],
  );

  const filteredPhotographers = useMemo(() => {
    if (!Array.isArray(photographers) || photographers.length === 0) return [];
    
    const filtered = photographers.filter(p => {
      if (!p) return false;
      
      // Determine availability: if availability data is loaded, use that; otherwise all are available
      const isAvailable = hasAvailabilityData 
        ? availabilitySet.has(p.id) 
        : true;
      
      if (tab === 'available') {
        return isAvailable;
      }
      if (tab === 'booked') {
        if (hasAvailabilityData) {
          return !availabilitySet.has(p.id) && (p.status === 'busy' || p.status === 'editing');
        }
        return false;
      }
      // 'all' tab shows everyone
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'load') return (a.loadToday || 0) - (b.loadToday || 0);
      if (sortBy === 'alpha') return (a.name || '').localeCompare(b.name || '');
      const aTime = a.availableFrom || '23:59';
      const bTime = b.availableFrom || '23:59';
      return aTime.localeCompare(bTime);
    });
  }, [photographers, tab, sortBy, hasAvailabilityData, availabilitySet]);

  // Measure the first photographer row height so we can cap the scroll list at ~8 rows.
  useEffect(() => {
    const container = listScrollRef.current;
    if (!container) return;
    const firstRow = container.querySelector<HTMLElement>('[data-photographer-row="true"]');
    if (!firstRow) return;
    const update = () => {
      const h = firstRow.offsetHeight;
      if (h > 0) setRowHeight(h);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(firstRow);
    return () => observer.disconnect();
  }, [filteredPhotographers, showContactActions]);

  return (
    <Card className={cn(DASHBOARD_MOBILE_PANEL_CLASS, "p-0 sm:p-0 h-full flex-1 flex flex-col overflow-hidden min-h-0")}>
      <div className={cn(sectionGutter, "space-y-1.5 border-b border-border/60 py-2 sm:space-y-3 sm:py-5")}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground sm:text-lg">Assign Photographers</h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted p-1 text-[10px] text-muted-foreground sm:gap-3 sm:rounded-xl sm:p-2 sm:text-[11px]">
          <span>Avail: <b className="text-foreground">{stats.available}</b></span>
          <span className="w-px h-3 bg-border" />
          <span>Booked: <b className="text-foreground">{stats.booked}</b></span>
          <span className="w-px h-3 bg-border" />
          <span>Offline: <b className="text-foreground">{stats.offline}</b></span>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5 text-[10px] font-semibold uppercase tracking-wide sm:rounded-xl sm:p-1 sm:text-[11px]">
          {(['available', 'booked', 'all'] as Tab[]).map(value => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                'flex-1 rounded-md py-0.5 transition-all sm:rounded-lg sm:py-1.5',
                tab === value
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={listScrollRef}
        style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
        className={cn(
          listGutter,
          "hidden-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-1.5 sm:py-4",
          filteredPhotographers.length === 0 ? "flex items-center justify-center" : "space-y-1.5 sm:space-y-2",
        )}
      >
        {filteredPhotographers.length === 0 ? (
          <div className="w-full text-center text-sm text-slate-500">
            No photographers match this filter.
          </div>
        ) : (
          filteredPhotographers.map((photographer) => (
            <div
              key={photographer.id}
              role="button"
              tabIndex={0}
              data-photographer-row="true"
              onClick={() => handlePhotographerClick(photographer)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handlePhotographerClick(photographer);
                }
              }}
              className="assign-photographer-row mx-auto flex w-full flex-col gap-1.5 rounded-xl border border-transparent px-2 py-2 text-left transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-3"
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <Avatar
                  src={photographer.avatar}
                  initials={getInitials(photographer.name)}
                  className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0"
                  status={availabilitySet.has(photographer.id) || !hasAvailabilityData ? 'free' : photographer.status}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-tight text-foreground">
                        <HoverMarqueeText text={photographer.name} />
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-muted-foreground">
                        {(photographer.loadToday ?? 0) > 0 && (
                          <span>{photographer.loadToday} jobs</span>
                        )}
                        {photographer.travelRange != null && (
                          <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-muted-foreground/70">
                            <MapPin size={10} className="sm:w-3 sm:h-3" />
                            {photographer.travelRange} {photographer.travelRangeUnit === 'km' ? 'km' : 'mi'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-[6.5rem] flex-shrink-0 text-right sm:w-[7.25rem]">
                      <span className="block text-[10px] sm:text-[11px] text-muted-foreground break-words">
                        {photographer.region}
                      </span>
                      <span className="mt-1 block text-[10px] sm:text-[11px] text-muted-foreground/70">
                        Next slot {photographer.nextSlot ? photographer.nextSlot : 'N/A'}
                      </span>
                    </div>
                  </div>
                  {showContactActions && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground mt-2">
                      {photographer.phone && (
                        <>
                          <a
                            href={`tel:${photographer.phone}`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border bg-background hover:bg-primary/10"
                          >
                            <Phone size={10} className="sm:w-3 sm:h-3" />
                            Call
                          </a>
                          <a
                            href={`sms:${photographer.phone}`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border bg-background hover:bg-primary/10"
                          >
                            <MessageSquare size={10} className="sm:w-3 sm:h-3" />
                            Text
                          </a>
                        </>
                      )}
                      {photographer.email && (
                        <a
                          href={`mailto:${photographer.email}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border bg-background hover:bg-primary/10"
                        >
                          <Mail size={10} className="sm:w-3 sm:h-3" />
                          Email
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={cn(sectionGutter, "mt-auto border-t border-border/60 py-2 sm:py-5")}>
        <div className="mb-2 space-y-1.5 sm:mb-3 sm:space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Select window</p>
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {(['today', 'week', 'month'] as WindowPreset[]).map((value) => (
              <button
                key={value}
                onClick={() => handlePresetChange(value)}
                className={cn(
                  'rounded-md border py-0.5 text-[10px] font-semibold sm:rounded-lg sm:py-1.5 sm:text-xs',
                  preset === value
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {value === 'today' ? 'Today' : value === 'week' ? 'This week' : 'This month'}
              </button>
            ))}
          </div>
          {availabilityLoading && (
            <p className="text-[10px] sm:text-xs text-muted-foreground">Checking availability…</p>
          )}
          {availabilityError && (
            <p className="text-[10px] sm:text-xs text-destructive">{availabilityError}</p>
          )}
        </div>
        <button
          onClick={onViewSchedule}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80 sm:rounded-xl sm:py-2.5 sm:text-sm"
        >
          View full schedule
          <ChevronRight size={12} className="sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
    </Card>
  );
};
