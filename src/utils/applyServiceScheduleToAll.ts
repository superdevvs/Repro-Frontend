export type ServiceSchedulePatch = {
  date: string;
  time: string;
};

/**
 * Copy one service's date+time onto every target service id.
 * Pure helper shared by Overview edit and Book Shoot Apply all.
 */
export function applyServiceScheduleToAllIds(
  current: Record<string, { date?: string; time?: string } | undefined>,
  targetIds: string[],
  source: ServiceSchedulePatch,
): Record<string, { date: string; time: string }> {
  const next: Record<string, { date: string; time: string }> = {};
  Object.entries(current).forEach(([id, schedule]) => {
    next[id] = {
      date: schedule?.date ?? '',
      time: schedule?.time ?? '',
    };
  });
  targetIds.forEach((id) => {
    next[id] = {
      date: source.date,
      time: source.time,
    };
  });
  return next;
}
