import React, { useLayoutEffect, useRef } from 'react';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import type { ShootData } from '@/types/shoots';
import { calendarClock, formatCalendarPart, layoutCalendarSlots, type CalendarEntry } from './calendarModel';
import { CalendarShootButton } from './CalendarShootCards';

export function CalendarDayStrip({ dates, date, today, entriesByDate, onDateChange, countsForSelectedDayOnly = false }: {
  dates: string[]; date: string; today: string; entriesByDate: Map<string, CalendarEntry[]>; onDateChange: (date: string) => void;
  countsForSelectedDayOnly?: boolean;
}) {
  const { formatDate } = useUserPreferences();
  return <div className="shc-day-strip" aria-label="Choose a day">{dates.map(day => {
    const count = countsForSelectedDayOnly && day !== date ? null : (entriesByDate.get(day)?.length ?? 0);
    return <button type="button" key={day} className={`shc-day${day === today ? ' is-today' : ''}`} data-calendar-date={day}
      aria-label={`${formatDate(day)}${count === null ? '' : `, ${count} ${count === 1 ? 'shoot' : 'shoots'}`}${day === today ? ', today' : ''}`}
      aria-pressed={day === date} aria-current={day === today ? 'date' : undefined} onClick={() => onDateChange(day)}>
      <span className="shc-day-name">{formatCalendarPart(day, { weekday: 'short' })}{day === today && <i aria-hidden="true" />}</span>
      <span className="shc-day-date"><strong>{Number(day.slice(-2))}</strong><small>{formatCalendarPart(day, { month: 'short' })}</small></span>
      <span className={`shc-day-count${count ? '' : ' is-empty'}`} aria-hidden="true"><b>{count ?? '—'}</b><small>{count === null ? 'select' : count === 1 ? 'shoot' : 'shoots'}</small></span>
    </button>;
  })}</div>;
}

export function CalendarTimeline({ dates, date, entriesByDate, onShootSelect, onShowAgenda }: {
  dates: string[]; date: string; entriesByDate: Map<string, CalendarEntry[]>;
  onShootSelect: (shoot: ShootData) => void; onShowAgenda: (date: string) => void;
}) {
  const { formatTime, formatDate } = useUserPreferences();
  const visible = dates.flatMap(day => entriesByDate.get(day) ?? []);
  const timed = visible.filter(entry => entry.minutes !== null);
  const startHour = Math.min(8, ...timed.map(entry => Math.floor(entry.minutes / 60)));
  const endHour = Math.min(24, Math.max(19, ...timed.map(entry => Math.ceil((entry.minutes + 60) / 60))));
  const hourHeight = dates.length === 1 ? 96 : 88;
  const height = (endHour - startHour) * hourHeight + 38;
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedTimes = (entriesByDate.get(date) ?? []).flatMap(entry => entry.minutes === null ? [] : [entry.minutes]);
  const firstSelectedTime = selectedTimes.length ? Math.min(...selectedTimes) : 8 * 60;
  useLayoutEffect(() => {
    // Other days can extend the rail to midnight. Start near the selected day's
    // work while leaving those earlier hours reachable by ordinary scrolling.
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (firstSelectedTime - startHour * 60 - 30) / 60 * hourHeight);
  }, [date, startHour, firstSelectedTime, hourHeight]);
  return <>
    {dates.length === 1 && <div className="shc-timeline-heading"><strong>{formatDate(date)}</strong><span>{visible.length} {visible.length === 1 ? 'shoot' : 'shoots'}</span></div>}
    <div className="shc-timeline-scroll" ref={scrollRef} data-testid="calendar-timeline-scroll"><div className={`shc-timeline${dates.length === 1 ? ' is-day' : ''}`} style={{ height, gridTemplateColumns: `48px repeat(${dates.length}, minmax(0, 1fr))`, '--calendar-hour': `${hourHeight}px` } as React.CSSProperties}>
      <div className="shc-hour-rail" aria-hidden="true">{Array.from({ length: endHour - startHour }, (_, index) => <span key={index} style={{ top: index * hourHeight }}>{formatTime(calendarClock((startHour + index) * 60))}</span>)}</div>
      {dates.map(day => {
        const entries = (entriesByDate.get(day) ?? []).filter(entry => entry.minutes !== null);
        const slots = layoutCalendarSlots(entries);
        const grouped = new Map<number, typeof slots>();
        slots.forEach(slot => grouped.set(slot.group, [...(grouped.get(slot.group) ?? []), slot]));
        return <div key={day} className={`shc-time-column${day === date ? ' is-selected' : ''}`} aria-label={formatDate(day)}>
          {!entries.length && <p className="shc-open-day">No timed shoots</p>}
          {[...grouped.values()].flatMap(group => {
            if (group[0].lanes > 3) return <button type="button" key={`group-${group[0].group}`} className="shc-dense-group" style={{ top: (group[0].start - startHour * 60) / 60 * hourHeight }} onClick={() => onShowAgenda(day)}>
              <time>{formatTime(calendarClock(group[0].start))}</time><strong>{group.length} overlapping shoots</strong><span>View day agenda</span>
            </button>;
            return group.map(slot => <CalendarShootButton key={slot.entry.shoot.id} entry={slot.entry} onShootSelect={onShootSelect}
              style={{ top: (slot.start - startHour * 60) / 60 * hourHeight, height: Math.max(34, (slot.end - slot.start) / 60 * hourHeight - 6), left: `calc(${slot.lane * 100 / slot.lanes}% + 4px)`, width: `calc(${100 / slot.lanes}% - 8px)` }} />);
          })}
        </div>;
      })}
    </div></div>
  </>;
}
