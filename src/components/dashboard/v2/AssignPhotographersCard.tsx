import React, { useMemo, useState, useEffect } from 'react';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronRight, Phone, Mail, MessageSquare } from 'lucide-react';
import { DashboardPhotographerSummary } from '@/types/dashboard';
import { Card, Avatar } from './SharedComponents';
import { cn } from '@/lib/utils';
import { usePhotographerAssignment } from '@/context/PhotographerAssignmentContext';

interface AvailabilityWindow {
  date: string;
  start_time: string;
  end_time: string;
}

interface AssignPhotographersCardProps {
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

export const AssignPhotographersCard: React.FC<AssignPhotographersCardProps> = ({
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
  const [tab, setTab] = useState<Tab>('available');
  const [sortBy, setSortBy] = useState<SortBy>('availability');
  const [preset, setPreset] = useState<WindowPreset>('today');
  const availabilitySet = useMemo(() => new Set(availablePhotographerIds), [availablePhotographerIds]);
  const hasAvailabilityData = availabilitySet.size > 0;

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

  const filteredPhotographers = useMemo(() => {
    const filtered = photographers.filter(p => {
      const isAvailable = hasAvailabilityData ? availabilitySet.has(p.id) : p.status !== 'busy';
      if (tab === 'available') return isAvailable;
      if (tab === 'booked') return !isAvailable;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'load') return a.loadToday - b.loadToday;
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      const aTime = a.availableFrom || '23:59';
      const bTime = b.availableFrom || '23:59';
      return aTime.localeCompare(bTime);
    });
  }, [photographers, tab, sortBy]);

  return (
    <Card className="p-0 h-full flex flex-col overflow-hidden min-h-0">
      <div className="p-3 sm:p-5 border-b border-border/60 space-y-2 sm:space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-foreground">Assign Photographers</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-muted-foreground bg-muted rounded-lg sm:rounded-xl p-1.5 sm:p-2">
          <span>Avail: <b className="text-foreground">{stats.available}</b></span>
          <span className="w-px h-3 bg-border" />
          <span>Booked: <b className="text-foreground">{stats.booked}</b></span>
          <span className="w-px h-3 bg-border" />
          <span>Offline: <b className="text-foreground">{stats.offline}</b></span>
        </div>
        <div className="flex p-0.5 sm:p-1 bg-muted rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide">
          {(['available', 'booked', 'all'] as Tab[]).map(value => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                'flex-1 py-1 sm:py-1.5 rounded-md sm:rounded-lg transition-all',
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

      <div className="max-h-[520px] overflow-y-auto px-3 sm:px-4 py-2 space-y-2 custom-scrollbar">
        {filteredPhotographers.map((photographer) => (
          <div
            key={photographer.id}
            role="button"
            tabIndex={0}
            onClick={() => handlePhotographerClick(photographer)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handlePhotographerClick(photographer);
              }
            }}
            className="w-full flex flex-col gap-2 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-transparent hover:border-primary/40 hover:bg-primary/5 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <Avatar
                src={photographer.avatar}
                initials={photographer.name.split(' ').map((n) => n[0]).join('')}
                className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0"
                status={availabilitySet.has(photographer.id) || !hasAvailabilityData ? 'free' : photographer.status}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">{photographer.name}</h3>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground flex-shrink-0">{photographer.region}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground mt-1 gap-2">
                  <span>{photographer.loadToday}/5 jobs</span>
                  <span className="text-muted-foreground/70 truncate">
                    Next slot {photographer.nextSlot ? photographer.nextSlot : 'N/A'}
                  </span>
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
        ))}
        {filteredPhotographers.length === 0 && (
          <div className="text-center py-6 text-sm text-slate-500">
            No photographers match this filter.
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 border-t border-border/60">
        <div className="space-y-2 mb-3">
          <p className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wide">Select window</p>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {(['today', 'week', 'month'] as WindowPreset[]).map((value) => (
              <button
                key={value}
                onClick={() => handlePresetChange(value)}
                className={cn(
                  'py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold border',
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
          className="w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-muted-foreground bg-muted hover:bg-muted/80 flex items-center justify-center gap-2 transition-colors"
        >
          View full schedule
          <ChevronRight size={12} className="sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
    </Card>
  );
};

