import type { ShootServiceObject } from '@/types/shoots';
import { shiftTravelPayload, type ScheduleChange } from '@/features/travel/daySchedule';
import { unitLinePayload } from './unitMutations';

/** Move one photographer's day while retaining every booked line and relative start. */
export function approvalScheduleChanges(lines: ShootServiceObject[], timezone: string | null | undefined, change: ScheduleChange) {
  if (change.offsetMinutes === 0) return {};
  const payload = shiftTravelPayload({ timezone, service_lines: lines.map(unitLinePayload) },
    change.offsetMinutes, change.timezone, change.visitScope);
  return Object.fromEntries((payload.service_lines as ReturnType<typeof unitLinePayload>[]).flatMap((line, index) =>
    line.scheduled_at !== (lines[index].scheduled_at ?? lines[index].scheduledAt ?? null)
      ? [[String(line.shoot_service_id), { scheduled_at: line.scheduled_at as string | null }]] : []));
}
