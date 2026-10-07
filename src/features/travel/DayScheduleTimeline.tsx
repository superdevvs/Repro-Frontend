import { useEffect, useRef, useState } from 'react';
import { atMinute, localSchedule, minuteOfDay, type DayBooking } from './daySchedule';
import './daySchedule.css';

const clock = (minutes: number) => `${Math.floor(minutes / 60) % 12 || 12}${minutes % 60 ? `:${String(minutes % 60).padStart(2, '0')}` : ''} ${minutes < 720 ? 'AM' : 'PM'}`;

export function DayScheduleTimeline({ bookings, date, timezone, onMove, onDragging, onError }: {
  bookings: DayBooking[]; date: string; timezone: string;
  onMove: (id: string, start: string) => void; onDragging: (dragging: boolean) => void; onError: (message: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [horizontal, setHorizontal] = useState(false);
  const drag = useRef<{ id: string; pointer: number; origin: number; minute: number; minimum: number } | null>(null);
  const initialBookings = useRef(bookings);
  const scale = horizontal ? 1.5 : 0.7;
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1100px) and (pointer: fine)');
    const update = () => setHorizontal(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const target = initialBookings.current.find(row => row.target);
    if (!target || !viewport.current) return;
    const earliest = Math.min(minuteOfDay(target.start, timezone), ...initialBookings.current.map(row => minuteOfDay(row.start, timezone)));
    const focus = Math.max(0, Math.min(480, earliest - 45));
    viewport.current.scrollTo(horizontal ? { left: focus * scale, top: 0 } : { top: focus * scale, left: 0 });
  }, [horizontal, timezone, scale]);
  const move = (row: DayBooking, minutes: number, minimum: number) => {
    try {
      const start = Math.max(minimum, Math.min(1440 - row.duration_minutes, Math.round(minutes / 15) * 15));
      onMove(row.id, atMinute(date, start, timezone, row.start));
      onError('');
    } catch (error) { onError(error instanceof Error ? error.message : 'Choose another time.'); }
  };
  const finish = () => { drag.current = null; onDragging(false); };
  return <div className="min-w-0">
    <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>Drag a booking to adjust its time · 15-minute steps</span><span><span className="text-violet-400">●</span> This shoot <span className="ml-3 text-slate-400">●</span> Existing booking</span></div>
    <div ref={viewport} className={`day-schedule-scroll ${horizontal ? 'horizontal' : 'vertical'}`} aria-label={`${date} booking timeline`}>
      <div className="day-schedule-canvas" style={horizontal ? { width: 1440 * scale, height: 170 } : { height: 1440 * scale, minWidth: 260 }}>
        {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="day-schedule-tick" style={horizontal ? { left: hour * 60 * scale, top: 0, bottom: 0 } : { top: hour * 60 * scale, left: 0, right: 0 }}><span>{clock(hour * 60)}</span></div>)}
        {bookings.map(row => {
          const start = localMinute(row.start), end = Math.min(1440, localMinute(row.end, true));
          const editable = Boolean(row.target || row.can_adjust);
          const overlap = bookings.some(other => other.id !== row.id && other.photographer_id === row.photographer_id && Date.parse(row.start) < Date.parse(other.end) && Date.parse(other.start) < Date.parse(row.end));
          return <button type="button" key={row.id} data-booking-id={row.id} className={`day-schedule-booking ${row.target ? 'target' : ''} ${overlap ? 'overlap' : ''}`}
            style={horizontal ? { left: start * scale, top: row.target ? 100 : 32, width: Math.max(65, (end - start) * scale), height: 54 }
              : { top: start * scale + 3, left: row.target ? 'calc(50% + 22px)' : 54, width: 'calc(50% - 33px)', height: Math.max(48, (end - start) * scale - 6) }}
            aria-label={`${row.target ? 'This shoot: ' : ''}${row.label}, ${clock(start)}–${clock(end)}, ${editable ? 'use arrow keys to move' : 'read only'}`}
            aria-disabled={!editable} title={editable ? 'Drag or use arrow keys to move by 15 minutes' : 'Open this booking separately to change its schedule'}
            onPointerDown={event => {
              if (!editable || event.button !== 0) return;
              const original = initialBookings.current.find(value => value.id === row.id) || row;
              drag.current = { id: row.id, pointer: event.pointerId, origin: horizontal ? event.clientX : event.clientY, minute: start, minimum: Math.min(480, minuteOfDay(original.start, timezone)) };
              event.currentTarget.setPointerCapture(event.pointerId); onDragging(true);
            }}
            onPointerMove={event => {
              const current = drag.current;
              if (!current || current.pointer !== event.pointerId || current.id !== row.id) return;
              const coordinate = horizontal ? event.clientX : event.clientY;
              move(row, current.minute + (coordinate - current.origin) / scale, current.minimum);
              const element = viewport.current;
              if (element) {
                const rect = element.getBoundingClientRect();
                const low = horizontal ? rect.left : rect.top, high = horizontal ? rect.right : rect.bottom;
                const delta = coordinate > high - 30 ? 12 : coordinate < low + 30 ? -12 : 0;
                if (delta) { element.scrollBy(horizontal ? { left: delta } : { top: delta }); current.origin -= delta; }
              }
            }}
            onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}
            onKeyDown={event => {
              if (!editable || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
              event.preventDefault();
              const original = initialBookings.current.find(value => value.id === row.id) || row;
              move(row, start + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 15 : -15), Math.min(480, minuteOfDay(original.start, timezone)));
            }}>
            {row.target && <small>{row.shoot_id ? 'This shoot' : 'New shoot'}</small>}<strong>{row.label}</strong><span>{clock(start)}–{clock(end)}</span>
          </button>;
        })}
      </div>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Only bookings on this date. Early shoots are brought into view automatically.</p>
  </div>;

  function localMinute(at: string, end = false) {
    const datePart = localSchedule(at, timezone).date;
    return datePart > date && end ? 1440 : datePart < date ? 0 : minuteOfDay(at, timezone);
  }
}
