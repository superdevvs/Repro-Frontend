export const normalizeDayOfWeek = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim().toLowerCase();
  const days: Record<string, string> = {
    '0': 'sunday',
    '1': 'monday',
    '2': 'tuesday',
    '3': 'wednesday',
    '4': 'thursday',
    '5': 'friday',
    '6': 'saturday',
    sun: 'sunday',
    sunday: 'sunday',
    mon: 'monday',
    monday: 'monday',
    tue: 'tuesday',
    tues: 'tuesday',
    tuesday: 'tuesday',
    wed: 'wednesday',
    weds: 'wednesday',
    wednesday: 'wednesday',
    thu: 'thursday',
    thur: 'thursday',
    thurs: 'thursday',
    thursday: 'thursday',
    fri: 'friday',
    friday: 'friday',
    sat: 'saturday',
    saturday: 'saturday',
  };
  return days[normalized] ?? normalized;
};
