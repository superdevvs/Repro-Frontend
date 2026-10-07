import type { Dispatch, SetStateAction } from 'react';
import { format } from 'date-fns';
import { toBackendTime } from '@/pages/bookShootModel';
import { localSchedule, shiftScheduleFields, type ScheduleChange, type ScheduleFields } from './daySchedule';

export function bookingDayScheduleHandler({ date, time, setDate, setTime, setServiceSchedules }: {
  date?: Date; time: string; setDate: Dispatch<SetStateAction<Date | undefined>>;
  setTime: Dispatch<SetStateAction<string>>; setServiceSchedules: Dispatch<SetStateAction<Record<string, ScheduleFields>>>;
}) {
  return (change: ScheduleChange) => {
    const next = localSchedule(change.scheduledAt, change.timezone);
    setServiceSchedules(current => shiftScheduleFields(current, { date: date ? format(date, 'yyyy-MM-dd') : '', time: toBackendTime(time) }, change));
    setDate(new Date(`${next.date}T12:00:00`)); setTime(next.time);
  };
}
