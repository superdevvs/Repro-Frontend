import React from 'react';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import type { ShootData } from '@/types/shoots';
import { formatCalendarPart, type CalendarEntry } from './calendarModel';
import { CalendarShootButton } from './CalendarShootCards';

export function CalendarMonth({ dates, date, today, entriesByDate, mobile, onDateChange, onShowAgenda, onShootSelect }: {
  dates: string[];
  date: string;
  today: string;
  entriesByDate: Map<string, CalendarEntry[]>;
  mobile: boolean;
  onDateChange: (date: string) => void;
  onShowAgenda: (date: string) => void;
  onShootSelect: (shoot: ShootData) => void;
}) {
  const { formatDate } = useUserPreferences();
  const limit = mobile ? 2 : 3;
  return <div className="shc-month" aria-label="Month calendar">
    <div className="shc-month-weekdays" aria-hidden="true">{dates.slice(0, 7).map(day => <span key={day}>{formatCalendarPart(day, { weekday: 'short' })}</span>)}</div>
    <div className="shc-month-grid">{dates.map(day => {
      const entries = entriesByDate.get(day) ?? [];
      return <div key={day} className={`shc-month-cell${day.slice(0, 7) !== date.slice(0, 7) ? ' is-outside' : ''}${day === date ? ' is-selected' : ''}`}>
        <button type="button" className={`shc-month-date${day === today ? ' is-today' : ''}`} data-calendar-date={day}
          aria-label={`${formatDate(day)}, ${entries.length} ${entries.length === 1 ? 'shoot' : 'shoots'}${day === today ? ', today' : ''}`}
          aria-pressed={day === date} aria-current={day === today ? 'date' : undefined} onClick={() => onDateChange(day)}>
          <strong>{Number(day.slice(-2))}</strong><small>{entries.length > 0 && `${entries.length} ${entries.length === 1 ? 'shoot' : 'shoots'}`}</small>
        </button>
        <div className="shc-month-events">{entries.slice(0, limit).map(entry => <CalendarShootButton compact key={entry.shoot.id} entry={entry} onShootSelect={onShootSelect} />)}
          {entries.length > limit && <button type="button" className="shc-more" aria-label={`Show all ${entries.length} shoots for ${formatDate(day)}`} onClick={() => onShowAgenda(day)}>+{entries.length - limit} more</button>}
        </div>
      </div>;
    })}</div>
  </div>;
}
