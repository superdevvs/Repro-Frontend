import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { format } from 'date-fns';
import { toBackendTime, type ServicePackage, type ServiceScheduleMap } from './bookShootModel';
import { photographerRequiredServices } from '@/utils/photographerAssignment';

type Options = {
  date?: Date;
  time: string;
  setDate: Dispatch<SetStateAction<Date | undefined>>;
  setTime: Dispatch<SetStateAction<string>>;
  setServiceSchedules: Dispatch<SetStateAction<ServiceScheduleMap>>;
  selectedServices: ServicePackage[];
  multiUnit: boolean;
};

/** Main appointment controls must move the service itinerary used for checks and saving. */
export function useBookingMainSchedule({ date, time, setDate, setTime, setServiceSchedules, selectedServices, multiUnit }: Options) {
  const day = date ? format(date, 'yyyy-MM-dd') : '';
  const required = photographerRequiredServices(selectedServices);
  const singleServiceId = required.length === 1 ? required[0].id : undefined;
  const update = useCallback((field: 'date' | 'time') => {
    if (multiUnit) return;
    setServiceSchedules(current => {
      let changed = false;
      const next = { ...current };
      for (const [id, schedule] of Object.entries(current)) {
        const value = schedule[field];
        const matches = (!schedule.date || schedule.date === day)
          && (!schedule.time || toBackendTime(schedule.time) === toBackendTime(time));
        if (value && (id === singleServiceId || matches)) {
          // Removing the inherited field makes every consumer use the new main value.
          const updated = { ...schedule };
          delete updated[field];
          next[id] = updated;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [day, multiUnit, setServiceSchedules, singleServiceId, time]);
  const changeDate = useCallback<Dispatch<SetStateAction<Date | undefined>>>(value => {
    const next = typeof value === 'function' ? value(date) : value;
    update('date');
    setDate(next);
  }, [date, setDate, update]);
  const changeTime = useCallback<Dispatch<SetStateAction<string>>>(value => {
    const next = typeof value === 'function' ? value(time) : value;
    update('time');
    setTime(next);
  }, [setTime, time, update]);
  return { setDate: changeDate, setTime: changeTime };
}
