import type { ShootData } from '@/types/shoots';
import { getShootSchedule } from '@/utils/shootSchedule';

export type CalendarViewMode = 'month' | 'week' | 'day';
export interface CalendarDateRange { start: string; end: string }
export interface CalendarEntry {
  shoot: ShootData;
  date: string | null;
  time: string | null;
  minutes: number | null;
}
export interface CalendarSlot {
  entry: CalendarEntry;
  start: number;
  end: number;
  lane: number;
  lanes: number;
  group: number;
}

const pad = (value: number) => String(value).padStart(2, '0');
const utcDate = (date: string) => new Date(`${date}T12:00:00Z`);
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function isCalendarDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = utcDate(value);
  return Number.isFinite(parsed.getTime()) && isoDate(parsed) === value;
}

/** The viewer's current day; booking dates themselves never convert to this zone. */
export function getCalendarToday(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addCalendarDays(date: string, amount: number): string {
  const result = utcDate(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return isoDate(result);
}

export function startOfCalendarWeek(date: string): string {
  return addCalendarDays(date, -((utcDate(date).getUTCDay() + 6) % 7));
}

/** Includes spillover days actually displayed in the month grid. */
export function getCalendarDateRange(date: string, view: CalendarViewMode): CalendarDateRange {
  const anchor = isCalendarDate(date) ? date : getCalendarToday();
  if (view === 'day') return { start: anchor, end: anchor };
  if (view === 'week') {
    const start = startOfCalendarWeek(anchor);
    return { start, end: addCalendarDays(start, 6) };
  }
  const first = anchor.slice(0, 7) + '-01';
  const last = utcDate(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return { start: startOfCalendarWeek(first), end: addCalendarDays(startOfCalendarWeek(isoDate(last)), 6) };
}

export function getCalendarDates(range: CalendarDateRange): string[] {
  const result: string[] = [];
  for (let date = range.start; date <= range.end; date = addCalendarDays(date, 1)) result.push(date);
  return result;
}

export function moveCalendarDate(date: string, view: CalendarViewMode, direction: number): string {
  if (view !== 'month') return addCalendarDays(date, direction * (view === 'week' ? 7 : 1));
  const target = utcDate(date.slice(0, 7) + '-01');
  target.setUTCMonth(target.getUTCMonth() + direction);
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(Number(date.slice(-2)), last));
  return isoDate(target);
}

export function formatCalendarPart(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(utcDate(date));
}

export function getCalendarPeriodLabel(date: string, view: CalendarViewMode, formatDate: (date: string) => string): string {
  if (view === 'month') return formatCalendarPart(date, { month: 'long', year: 'numeric' });
  if (view === 'day') return formatDate(date);
  const range = getCalendarDateRange(date, view);
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
}

/** Short labels for the mobile period toolbar (saves a line vs full locale dates). */
export function getCompactCalendarPeriodLabel(date: string, view: CalendarViewMode): string {
  if (view === 'month') return formatCalendarPart(date, { month: 'short', year: 'numeric' });
  if (view === 'day') return formatCalendarPart(date, { weekday: 'short', month: 'short', day: 'numeric' });
  const range = getCalendarDateRange(date, view);
  const start = formatCalendarPart(range.start, { month: 'short', day: 'numeric' });
  const end = formatCalendarPart(range.end, { month: 'short', day: 'numeric' });
  return `${start} – ${end}`;
}

export function getShootCalendarDate(shoot: ShootData): string | null {
  const { date } = getShootSchedule(shoot);
  return isCalendarDate(date) ? date : null;
}

export function buildCalendarEntries(shoots: ShootData[]): CalendarEntry[] {
  const seen = new Set<string>();
  return shoots.filter(shoot => {
    const key = String(shoot.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(shoot => {
    const schedule = getShootSchedule(shoot);
    const time = schedule.time || null;
    const [hour, minute] = time ? time.split(':').map(Number) : [];
    return { shoot, date: isCalendarDate(schedule.date) ? schedule.date : null, time, minutes: time ? hour * 60 + minute : null };
  }).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')
    || (a.minutes ?? Infinity) - (b.minutes ?? Infinity)
    || String(a.shoot.id).localeCompare(String(b.shoot.id), undefined, { numeric: true }));
}

/**
 * A shoot has a start time, not an authoritative aggregate duration. An hour of
 * visual space keeps start cards legible; it is never presented as an end time.
 * Connected overlap groups share lane widths, including chained overlaps.
 */
export function layoutCalendarSlots(entries: CalendarEntry[]): CalendarSlot[] {
  const result: CalendarSlot[] = [];
  let group: Omit<CalendarSlot, 'lanes'>[] = [];
  let laneEnds: number[] = [];
  let groupNumber = 0;
  const flush = () => {
    group.forEach(slot => result.push({ ...slot, lanes: laneEnds.length }));
    group = []; laneEnds = []; groupNumber++;
  };
  [...entries].filter(entry => entry.minutes !== null).sort((a, b) => a.minutes - b.minutes
    || String(a.shoot.id).localeCompare(String(b.shoot.id), undefined, { numeric: true })).forEach(entry => {
    const start = entry.minutes;
    const end = Math.min(start + 60, 1440);
    if (group.length && start >= Math.max(...laneEnds)) flush();
    let lane = laneEnds.findIndex(value => value <= start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = end;
    group.push({ entry, start, end, lane, group: groupNumber });
  });
  flush();
  return result;
}

export const calendarClock = (minutes: number): string => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
