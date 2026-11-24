import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';

const parse = (value: string | null | undefined) => (value ? parseISO(value) : null);

/** "Today 2:30 pm", "Tomorrow 9:00 am", "Thu 26 Nov, 10:00 am". */
export function when(value: string | null | undefined): string {
  const d = parse(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const time = format(d, 'h:mm a').toLowerCase();
  if (isToday(d)) return `Today ${time}`;
  if (isTomorrow(d)) return `Tomorrow ${time}`;
  if (isYesterday(d)) return `Yesterday ${time}`;
  return `${format(d, 'EEE d MMM')}, ${time}`;
}

export function day(value: string | null | undefined): string {
  const d = parse(value);
  return d && !Number.isNaN(d.getTime()) ? format(d, 'd MMM yyyy') : '—';
}

export function shortDay(value: string | null | undefined): string {
  const d = parse(value);
  return d && !Number.isNaN(d.getTime()) ? format(d, 'EEE d MMM') : '—';
}

export function ago(value: string | null | undefined): string {
  const d = parse(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  const days = differenceInCalendarDays(new Date(), d);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function time(value: string | null | undefined): string {
  const d = parse(value);
  return d && !Number.isNaN(d.getTime()) ? format(d, 'h:mm a').toLowerCase() : '';
}

export function money(value: number | null | undefined): string {
  return `$${(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Value for <input type="datetime-local"> from an ISO string or a Date. */
export function toLocalInput(value: string | Date | null | undefined): string {
  const d = typeof value === 'string' ? parse(value) : value ?? null;
  return d && !Number.isNaN(d.getTime()) ? format(d, "yyyy-MM-dd'T'HH:mm") : '';
}

export function scheduleTimeLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone === 'America/New_York' ? 'Eastern time' : `Days grouped in Eastern time · Times shown in ${zone.replaceAll('_', ' ')}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
