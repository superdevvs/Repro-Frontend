import type { ShootServiceObject } from '@/types/shoots';
import { shiftTravelPayload, shiftTravelVisit, type ScheduleChange } from '@/features/travel/daySchedule';
import { unitLinePayload } from './unitMutations';

/** Move one photographer's day while retaining every booked line and relative start. */
export function approvalScheduleChanges(lines: ShootServiceObject[], timezone: string | null | undefined, change: ScheduleChange) {
  if (change.offsetMinutes === 0 && !Object.keys(change.serviceDurations ?? {}).length) return {};
  const original = { timezone, service_lines: lines.map(unitLinePayload) };
  const payload = change.photographerId ? shiftTravelVisit(original, change) : shiftTravelPayload(original,
    change.offsetMinutes, change.timezone, change.visitScope);
  return Object.fromEntries((payload.service_lines as ReturnType<typeof unitLinePayload>[]).flatMap((line, index) =>
    line.scheduled_at !== (lines[index].scheduled_at ?? lines[index].scheduledAt ?? null) || line.duration_minutes !== lines[index].duration_minutes
      ? [[String(line.shoot_service_id), { scheduled_at: line.scheduled_at as string | null,
        ...(line.duration_minutes !== lines[index].duration_minutes ? { duration_minutes: line.duration_minutes } : {}) }]] : []));
}
