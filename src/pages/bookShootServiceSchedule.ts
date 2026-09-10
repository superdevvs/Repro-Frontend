import { toBackendTime, type ServiceScheduleMap } from './bookShootModel';
import { buildShootScheduleTimestamp, findServiceScheduleTimestamp } from '@/utils/shootScheduleSubmission';

type ScheduleSource = NonNullable<Parameters<typeof findServiceScheduleTimestamp>[0]> & { timezone?: string | null };

export const buildBookShootServiceSchedule = (
  serviceId: string,
  schedules: ServiceScheduleMap,
  orderDate: string,
  orderTime: string,
  source?: ScheduleSource | null,
): string | null => {
  const customSchedule = schedules[serviceId];
  const date = customSchedule?.date || orderDate;
  const time = toBackendTime(customSchedule?.time || orderTime);
  return date && time
    ? buildShootScheduleTimestamp(date, time, source?.timezone, findServiceScheduleTimestamp(source, serviceId))
    : null;
};
