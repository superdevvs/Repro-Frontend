import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { format } from 'date-fns';
import type { ServiceScheduleFields } from './shootEditModalTypes';

type InheritedServiceScheduleOptions = {
  defaultSchedule: ServiceScheduleFields;
  inheritedIds: MutableRefObject<Set<string>>;
  setServiceSchedules: Dispatch<SetStateAction<Record<string, ServiceScheduleFields>>>;
  setScheduledDate: Dispatch<SetStateAction<Date | undefined>>;
  setScheduledTime: Dispatch<SetStateAction<string>>;
};

/** Newly added services inherit the main appointment; removed ones lose that link. */
export function syncInheritedServiceScheduleIds(
  inheritedIds: Set<string>, selectedIds: Set<string>, schedules: Record<string, ServiceScheduleFields>,
) {
  selectedIds.forEach(id => { if (!schedules[id]) inheritedIds.add(id); });
  inheritedIds.forEach(id => { if (!selectedIds.has(id)) inheritedIds.delete(id); });
}

/** Keep linked service appointments synchronized during main date/time edits. */
export function useInheritedServiceSchedule({
  defaultSchedule, inheritedIds, setServiceSchedules, setScheduledDate, setScheduledTime,
}: InheritedServiceScheduleOptions) {
  const orderScheduleRef = useRef(defaultSchedule);
  useEffect(() => { orderScheduleRef.current = defaultSchedule; }, [defaultSchedule]);
  const updateOrderSchedule = (next: ServiceScheduleFields) => {
    orderScheduleRef.current = next;
    // A separate appointment may coincide with an intermediate main edit.
    // Only the membership decided at load/add time controls inheritance.
    const linkedIds = new Set(inheritedIds.current);
    setServiceSchedules(current => Object.fromEntries(Object.entries(current).map(([id, schedule]) => [
      id, linkedIds.has(id) ? next : schedule,
    ])));
  };
  const changeScheduledDate = (value: Date | undefined) => {
    updateOrderSchedule({ ...orderScheduleRef.current, date: value ? format(value, 'yyyy-MM-dd') : '' });
    setScheduledDate(value);
  };
  const changeScheduledTime = (value: string) => {
    updateOrderSchedule({ ...orderScheduleRef.current, time: value });
    setScheduledTime(value);
  };
  return { changeScheduledDate, changeScheduledTime };
}
