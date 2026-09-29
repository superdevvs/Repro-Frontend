import React, { useMemo, useRef, useState, useEffect } from 'react';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import {
  ChevronRight,
  Phone,
  Mail,
  MessageSquare,
  MapPin,
  MoreVertical,
  SlidersHorizontal,
} from 'lucide-react';
import { DashboardPhotographerSummary } from '@/types/dashboard';
import { Card, Avatar } from './SharedComponents';
import { cn, getInitials } from '@/lib/utils';
import { usePhotographerAssignment } from '@/context/PhotographerAssignmentContext';
import { useMediaQuery } from '@/hooks/use-media-query';
import { DASHBOARD_MOBILE_PANEL_CLASS, resolveDashboardListMaxHeight } from '@/features/dashboard/utils/dashboardMobilePanel';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

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

const TAB_LABELS: Record<Tab, string> = {
  available: 'Available',
  booked: 'Booked',
  all: 'All',
};

const PRESET_LABELS: Record<WindowPreset, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
};

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionPhotographer, setActionPhotographer] = useState<DashboardPhotographerSummary | null>(null);
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

  const handleViewSchedule = () => {
    setFiltersOpen(false);
    onViewSchedule?.();
  };

  const photographerHasContact = (photographer: DashboardPhotographerSummary) =>
    Boolean(photographer.phone || photographer.email);

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

  const renderTabPills = (opts?: { className?: string; onSelect?: () => void }) => (
    <div
      className={cn(
        'flex rounded-lg bg-muted p-0.5 text-[10px] font-semibold uppercase tracking-wide sm:rounded-xl sm:p-1 sm:text-[11px]',
        opts?.className,
      )}
    >
      {(['available', 'booked', 'all'] as Tab[]).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            setTab(value);
            opts?.onSelect?.();
          }}
          className={cn(
            'flex-1 rounded-md py-1.5 transition-all sm:rounded-lg sm:py-1.5',
            tab === value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );

  const renderWindowPresets = (opts?: { className?: string }) => (
    <div className={cn('space-y-1.5 sm:space-y-2', opts?.className)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-[11px]">Select window</p>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {(['today', 'week', 'month'] as WindowPreset[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => handlePresetChange(value)}
            className={cn(
              'rounded-md border py-1.5 text-[10px] font-semibold sm:rounded-lg sm:py-1.5 sm:text-xs',
              preset === value
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {PRESET_LABELS[value]}
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
  );

  const renderViewScheduleButton = (opts?: { className?: string; onClick?: () => void }) => (
    <button
      type="button"
      onClick={opts?.onClick ?? onViewSchedule}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-lg bg-muted py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80 sm:rounded-xl sm:py-2.5 sm:text-sm',
        opts?.className,
      )}
    >
      View full schedule
      <ChevronRight size={12} className="sm:w-3.5 sm:h-3.5" />
    </button>
  );

  const renderContactPills = (photographer: DashboardPhotographerSummary) => (
    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground sm:gap-2 sm:text-[11px]">
      {photographer.phone && (
        <>
          <a
            href={`tel:${photographer.phone}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 hover:bg-primary/10 sm:px-2 sm:py-1"
          >
            <Phone size={10} className="sm:h-3 sm:w-3" />
            Call
          </a>
          <a
            href={`sms:${photographer.phone}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 hover:bg-primary/10 sm:px-2 sm:py-1"
          >
            <MessageSquare size={10} className="sm:h-3 sm:w-3" />
            Text
          </a>
        </>
      )}
      {photographer.email && (
        <a
          href={`mailto:${photographer.email}`}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 hover:bg-primary/10 sm:px-2 sm:py-1"
        >
          <Mail size={10} className="sm:h-3 sm:w-3" />
          Email
        </a>
      )}
    </div>
  );

  return (
    <Card className={cn(DASHBOARD_MOBILE_PANEL_CLASS, 'flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0 sm:p-0')}>
      {/* Mobile: dense title + filter control. Desktop: full chrome with tabs. */}
      <div className={cn(sectionGutter, 'border-b border-border/60 py-2 sm:space-y-3 sm:py-5')}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground sm:text-lg">Assign Photographers</h2>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:hidden">
              {TAB_LABELS[tab]} · {PRESET_LABELS[preset]}
              {availabilityLoading ? ' · Checking…' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:hidden"
            aria-label="Filters and schedule options"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-muted p-1 text-[10px] text-muted-foreground sm:mt-0 sm:gap-3 sm:rounded-xl sm:p-2 sm:text-[11px]">
          <span>
            Avail: <b className="text-foreground">{stats.available}</b>
          </span>
          <span className="h-3 w-px bg-border" />
          <span>
            Booked: <b className="text-foreground">{stats.booked}</b>
          </span>
          <span className="h-3 w-px bg-border" />
          <span>
            Offline: <b className="text-foreground">{stats.offline}</b>
          </span>
        </div>

        <div className="hidden sm:block">{renderTabPills()}</div>
      </div>

      <div
        ref={listScrollRef}
        style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}
        className={cn(
          listGutter,
          'hidden-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-1 sm:py-4',
          filteredPhotographers.length === 0 ? 'flex items-center justify-center' : 'space-y-1 sm:space-y-2',
        )}
      >
        {filteredPhotographers.length === 0 ? (
          <div className="w-full text-center text-sm text-slate-500">
            No photographers match this filter.
          </div>
        ) : (
          filteredPhotographers.map((photographer) => {
            const showRowMenu =
              showContactActions && photographerHasContact(photographer);

            return (
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
                className="assign-photographer-row mx-auto flex w-full flex-col gap-1 rounded-xl border border-transparent px-2 py-1.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-3"
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <Avatar
                    src={photographer.avatar}
                    initials={getInitials(photographer.name)}
                    className="h-9 w-9 flex-shrink-0 sm:h-12 sm:w-12"
                    status={availabilitySet.has(photographer.id) || !hasAvailabilityData ? 'free' : photographer.status}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-tight text-foreground">
                          <HoverMarqueeText text={photographer.name} />
                        </h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground sm:mt-1 sm:text-[11px]">
                          {(photographer.loadToday ?? 0) > 0 && (
                            <span>{photographer.loadToday} jobs</span>
                          )}
                          {photographer.travelRange != null && (
                            <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-muted-foreground/70">
                              <MapPin size={10} className="sm:h-3 sm:w-3" />
                              {photographer.travelRange}{' '}
                              {photographer.travelRangeUnit === 'km' ? 'km' : 'mi'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <div className="w-[5.5rem] text-right sm:w-[7.25rem]">
                          <span className="block break-words text-[10px] text-muted-foreground sm:text-[11px]">
                            {photographer.region}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-muted-foreground/70 sm:mt-1 sm:text-[11px]">
                            Next slot {photographer.nextSlot ? photographer.nextSlot : 'N/A'}
                          </span>
                        </div>
                        {showRowMenu && (
                          <button
                            type="button"
                            aria-label={`Contact ${photographer.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActionPhotographer(photographer);
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Desktop keeps inline Call/Text/Email; mobile uses kebab → action sheet */}
                    {showContactActions && (
                      <div className="hidden sm:block">{renderContactPills(photographer)}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop footer: window presets + view schedule. Hidden on mobile (lives in filters drawer). */}
      <div className={cn(sectionGutter, 'mt-auto hidden border-t border-border/60 py-5 sm:block')}>
        <div className="mb-3">{renderWindowPresets()}</div>
        {renderViewScheduleButton()}
      </div>

      {/* Mobile filters / schedule drawer */}
      <Drawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base">Filters & schedule</DrawerTitle>
            <DrawerDescription className="text-xs">
              Choose who to show, the availability window, or open the full schedule.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Show</p>
              {renderTabPills()}
            </div>
            {renderWindowPresets()}
            {renderViewScheduleButton({ onClick: handleViewSchedule })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Mobile per-photographer contact action sheet */}
      <Drawer
        open={Boolean(actionPhotographer)}
        onOpenChange={(open) => {
          if (!open) setActionPhotographer(null);
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-h-[50dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-base">
              {actionPhotographer?.name ?? 'Contact'}
            </DrawerTitle>
            <DrawerDescription className="text-xs">
              Call, text, or email this photographer.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-1 px-2 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            {actionPhotographer?.phone && (
              <>
                <a
                  href={`tel:${actionPhotographer.phone}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                  onClick={() => setActionPhotographer(null)}
                >
                  <Phone size={16} className="text-muted-foreground" />
                  Call
                </a>
                <a
                  href={`sms:${actionPhotographer.phone}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                  onClick={() => setActionPhotographer(null)}
                >
                  <MessageSquare size={16} className="text-muted-foreground" />
                  Text
                </a>
              </>
            )}
            {actionPhotographer?.email && (
              <a
                href={`mailto:${actionPhotographer.email}`}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                onClick={() => setActionPhotographer(null)}
              >
                <Mail size={16} className="text-muted-foreground" />
                Email
              </a>
            )}
            {!actionPhotographer?.phone && !actionPhotographer?.email && (
              <p className="px-3 py-2 text-sm text-muted-foreground">No contact details available.</p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </Card>
  );
};
