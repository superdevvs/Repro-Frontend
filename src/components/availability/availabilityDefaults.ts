import type { WeeklyScheduleItem } from '@/types/availability';

export const DEFAULT_WEEKLY_SCHEDULE: WeeklyScheduleItem[] = [
  { day: 'Mon', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Tue', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Wed', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Thu', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Fri', active: false, startTime: '9:00', endTime: '17:00' },
  { day: 'Sat', active: false, startTime: '10:00', endTime: '15:00' },
  { day: 'Sun', active: false, startTime: '10:00', endTime: '15:00' },
];

/** Starter when opening Default schedule with no existing recurring windows. */
export const DEFAULT_SCHEDULE_STARTER: WeeklyScheduleItem[] = [
  { day: 'Mon', active: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Tue', active: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Wed', active: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Thu', active: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Fri', active: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Sat', active: false, startTime: '10:00', endTime: '15:00' },
  { day: 'Sun', active: false, startTime: '10:00', endTime: '15:00' },
];
