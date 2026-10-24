import { eachDayOfInterval, startOfDay, format } from 'date-fns';
import type { BackendSlot } from '@/types/availability';
import { buildSelectedDateAvailabilities } from './selectors';
import { clockTime, photographerDay } from '@/components/availability/calendarModel';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';

/** Export actual occurrences and open windows, using the same rules as the calendar. */
export function buildAvailabilityExportEvents(rows: BackendSlot[], from: Date, to: Date, name: string, timezone?: string) {
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) return [];
  const people = [...new Set(rows.map(row => String(row.photographer_id)))];
  return eachDayOfInterval({start: startOfDay(from), end: startOfDay(to)}).flatMap(date => {
    const daily = buildSelectedDateAvailabilities({selectedPhotographer:'all',allBackendSlots:rows,backendSlots:[]},date);
    return people.flatMap(id => photographerDay({id,name},daily).free.map(window => {
      let start = new Date(date), end = new Date(date);
      start.setMinutes(window.start); end.setMinutes(window.end);
      if (timezone) {
        start = new Date(buildShootScheduleTimestamp(format(start,'yyyy-MM-dd'),clockTime(window.start),timezone)!);
        end = new Date(buildShootScheduleTimestamp(format(end,'yyyy-MM-dd'),clockTime(window.end),timezone)!);
      }
      return {title: `${name} Availability`, description: `Open time ${clockTime(window.start)}–${clockTime(window.end)}. Shoot travel is checked when booking.`,start,end};
    }));
  });
}
