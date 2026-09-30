import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import type { ShootData } from '@/types/shoots';
import { CalendarAgenda, CalendarInspector } from './CalendarShootCards';
import { CalendarUntimedMenu } from './CalendarUntimedMenu';
import { CalendarMonth } from './CalendarMonth';
import { CalendarDayStrip, CalendarTimeline } from './CalendarTimeline';
import { buildCalendarEntries, formatCalendarPart, getCalendarDateRange, getCalendarDates, getCalendarPeriodLabel, getCompactCalendarPeriodLabel, getCalendarToday, getShootCalendarDate, isCalendarDate, moveCalendarDate, type CalendarEntry, type CalendarViewMode } from './calendarModel';
import './calendar.css';

export interface ShootHistoryCalendarProps {
  shoots: ShootData[];
  view: CalendarViewMode;
  date: string;
  onViewChange: (view: CalendarViewMode) => void;
  onDateChange: (date: string) => void;
  onShootSelect: (shoot: ShootData) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  hideClientDetails: boolean;
  canViewPrices: boolean;
  filters?: React.ReactNode;
}

export function ShootHistoryCalendar({ shoots, view, date: requestedDate, onViewChange, onDateChange, onShootSelect, loading = false, error, onRetry, hideClientDetails, canViewPrices, filters }: ShootHistoryCalendarProps) {
  const { theme } = useTheme();
  const { formatDate } = useUserPreferences();
  const mobile = useIsMobile();
  const isDesktopViewport = useMediaQuery('(min-width: 1280px)');
  const fillViewport = !mobile && isDesktopViewport;
  const [today, setToday] = useState(getCalendarToday);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agendaTarget, setAgendaTarget] = useState<string | null>(null);
  const agendaRef = useRef<HTMLElement>(null);
  const date = isCalendarDate(requestedDate) ? requestedDate : today;
  const range = getCalendarDateRange(date, view);
  const entries = useMemo(() => buildCalendarEntries(shoots), [shoots]);
  const entriesByDate = useMemo(() => {
    const result = new Map<string, CalendarEntry[]>();
    entries.forEach(entry => { if (entry.date) result.set(entry.date, [...(result.get(entry.date) ?? []), entry]); });
    return result;
  }, [entries]);
  const dayEntries = entriesByDate.get(date) ?? [];
  const undated = entries.filter(entry => !entry.date);
  const visibleCount = entries.filter(entry => entry.date && entry.date >= range.start && entry.date <= range.end).length;
  const selected = dayEntries.find(entry => String(entry.shoot.id) === selectedId) ?? dayEntries[0] ?? null;
  const weekDates = getCalendarDates(getCalendarDateRange(date, 'week'));
  const timelineDates = mobile || view === 'day' ? [date] : weekDates;
  const untimed = entries.filter(entry => entry.minutes === null && entry.date && timelineDates.includes(entry.date));

  useEffect(() => {
    const timer = window.setInterval(() => setToday(getCalendarToday()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (agendaTarget !== date || loading) return;
    agendaRef.current?.focus();
    agendaRef.current?.scrollIntoView?.({ block: 'nearest' });
    setAgendaTarget(null);
  }, [agendaTarget, date, loading]);

  const showAgenda = (day: string) => { onDateChange(day); setAgendaTarget(day); };
  const selectShoot = (shoot: ShootData) => {
    const bookingDate = getShootCalendarDate(shoot);
    if (bookingDate && bookingDate !== date) onDateChange(bookingDate);
    setSelectedId(String(shoot.id));
    onShootSelect(shoot);
  };
  const selectedDayLabel = `${formatCalendarPart(date, { weekday: 'long' })}, ${formatDate(date)}`;

  return <section className={`shc${fillViewport ? ' is-viewport-fill' : ''}`} data-testid="shoot-history-calendar" data-theme={theme} aria-label="Shoot history calendar" aria-busy={loading} data-fill-viewport={fillViewport ? 'true' : undefined}>
    <div className="shc-layout">
      <section className="shc-planner" aria-label="Shoot schedule">
        <header className="shc-toolbar">
          <div className="shc-period"><h2 aria-live="polite">{mobile ? getCompactCalendarPeriodLabel(date, view) : getCalendarPeriodLabel(date, view, formatDate)}</h2><div className="shc-period-meta"><p><CalendarDays aria-hidden="true" /><span className="shc-period-detail">{view === 'month' ? 'Month overview' : 'Start-time view'}<span aria-hidden="true"> · </span></span>{loading ? 'Loading shoots…' : `${visibleCount} ${visibleCount === 1 ? 'shoot' : 'shoots'}`}</p>{view !== 'month' && !loading && !error && <CalendarUntimedMenu entries={untimed} theme={theme} onShootSelect={selectShoot} />}</div></div>
          <div className="shc-controls">
            <div className="shc-date-nav"><button type="button" aria-label={`Previous ${view}`} title={`Previous ${view}`} onClick={() => onDateChange(moveCalendarDate(date, view, -1))}><ChevronLeft aria-hidden="true" /></button><button type="button" className="shc-today" onClick={() => onDateChange(getCalendarToday())}>Today</button><button type="button" aria-label={`Next ${view}`} title={`Next ${view}`} onClick={() => onDateChange(moveCalendarDate(date, view, 1))}><ChevronRight aria-hidden="true" /></button></div>
            <div className="shc-view-switch" role="group" aria-label="Calendar view">{(['month', 'week', 'day'] as const).map(mode => <button type="button" key={mode} aria-pressed={view === mode} onClick={() => onViewChange(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
          </div>
        </header>
        {filters && <div className="shc-filters">{filters}</div>}
        {loading ? <div className="shc-feedback" role="status"><RefreshCw aria-hidden="true" className="shc-loading-icon" /><strong>Loading shoots in this date range…</strong></div>
          : error ? <div className="shc-feedback shc-error" role="alert"><strong>Unable to load this calendar</strong><p>{error}</p>{onRetry && <button type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />Try again</button>}</div>
            : <>
              {visibleCount === 0 && <p className="shc-empty-banner" role="status">No shoots match this date range and the current filters.</p>}
              {view === 'month' ? <CalendarMonth dates={getCalendarDates(range)} date={date} today={today} entriesByDate={entriesByDate} mobile={mobile} onDateChange={onDateChange} onShowAgenda={showAgenda} onShootSelect={selectShoot} />
                : <><CalendarDayStrip dates={weekDates} date={date} today={today} entriesByDate={entriesByDate} onDateChange={onDateChange} countsForSelectedDayOnly={view === 'day'} /><CalendarTimeline dates={timelineDates} date={date} entriesByDate={entriesByDate} onShootSelect={selectShoot} onShowAgenda={showAgenda} /></>}
              <footer className="shc-calendar-footer"><span>Times follow each shoot’s booking time zone.</span>{view !== 'month' && <span>Blocks mark starts, not duration.</span>}</footer>
            </>}
      </section>
      {!loading && !error && <aside className="shc-inspector" aria-label="Selected day and shoot details">
        <CalendarInspector entry={selected} onShootSelect={selectShoot} hideClientDetails={hideClientDetails} canViewPrices={canViewPrices} />
        <section className="shc-day-agenda" ref={agendaRef} tabIndex={-1} aria-label={`${selectedDayLabel} agenda`}>
          <header><h3>{selectedDayLabel}</h3><span>{dayEntries.length} {dayEntries.length === 1 ? 'shoot' : 'shoots'}</span></header>
          <CalendarAgenda entries={dayEntries} onShootSelect={selectShoot} />
        </section>
      </aside>}
    </div>
    {!loading && !error && undated.length > 0 && <section className="shc-undated" aria-label="Date not set"><header><h3>Date not set</h3><span>{undated.length} {undated.length === 1 ? 'shoot' : 'shoots'}</span></header><p>These shoots need a date before they can appear on the calendar.</p><CalendarAgenda entries={undated} onShootSelect={selectShoot} /></section>}
  </section>;
}
