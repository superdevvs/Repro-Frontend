import type { Dispatch, SetStateAction } from 'react';
import { format } from 'date-fns';
import { toBackendTime } from '@/pages/bookShootModel';
import { localSchedule, shiftScheduleFields, type ScheduleChange, type ScheduleFields } from './daySchedule';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { resolveServicePhotographerId, type AssignableService } from '@/utils/photographerAssignment';

export function bookingDayScheduleHandler({ date, time, setDate, setTime, setServiceSchedules, services = [], assignments = {}, photographer = '' }: {
  date?: Date; time: string; setDate: Dispatch<SetStateAction<Date | undefined>>;
  setTime: Dispatch<SetStateAction<string>>; setServiceSchedules: Dispatch<SetStateAction<Record<string, ScheduleFields>>>;
  services?: AssignableService[]; assignments?: Record<string, string>; photographer?: string;
}) {
  return (change: ScheduleChange) => {
    const next = localSchedule(change.scheduledAt, change.timezone);
    if (change.photographerId && change.fromStart && services.length) {
      setServiceSchedules(current => {
        const updated = { ...current };
        services.forEach(service => {
          const row = current[service.id] ?? {};
          const at = buildShootScheduleTimestamp(row.date ?? (date ? format(date, 'yyyy-MM-dd') : ''), row.time ?? time, change.timezone);
          if (Number(resolveServicePhotographerId(service, assignments, photographer)) === change.photographerId && at
            && Date.parse(at) >= Date.parse(change.fromStart!) && Date.parse(at) < Date.parse(change.fromEnd || change.fromStart!) + (change.fromEnd ? 0 : 1)) {
            updated[service.id] = { ...row, ...localSchedule(new Date(Date.parse(at) + change.offsetMinutes * 60000).toISOString(), change.timezone) };
          }
        });
        return updated;
      });
      return;
    }
    setServiceSchedules(current => shiftScheduleFields(current, { date: date ? format(date, 'yyyy-MM-dd') : '', time: toBackendTime(time) }, change));
    setDate(new Date(`${next.date}T12:00:00`)); setTime(next.time);
  };
}
