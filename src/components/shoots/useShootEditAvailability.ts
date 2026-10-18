import { useEffect, useMemo, useState } from 'react';
import { getDayAvailability, type DayAvailability } from '@/utils/availabilityProvider';
import { isTimeOutsideDayAvailability } from '@/utils/editPickerBounds';

export interface EditAvailabilityTarget { serviceId: string; photographerId: string; date: string }
const keyOf = (target: EditAvailabilityTarget) => `${target.photographerId}:${target.date}`;

/** Keep each service picker tied to its current assignee and appointment day. */
export function useShootEditAvailability(open: boolean, shootId: string, targets: EditAvailabilityTarget[]) {
  const key = JSON.stringify(targets);
  const stableTargets = useMemo(() => JSON.parse(key) as EditAvailabilityTarget[], [key]);
  const [days, setDays] = useState<Record<string, DayAvailability>>({});
  useEffect(() => {
    const controller = new AbortController();
    setDays({});
    if (open) {
      const unique = new Map(stableTargets.filter(t => t.photographerId && t.photographerId !== 'unassigned' && t.date)
        .map(target => [keyOf(target), target]));
      for (const [id, target] of unique) {
        void getDayAvailability(target.photographerId, new Date(`${target.date}T12:00:00`), controller.signal, shootId)
          .then(result => { if (!controller.signal.aborted) setDays(current => ({ ...current, [id]: result.day })); })
          .catch(() => { /* The save-time server check remains authoritative on lookup failure. */ });
      }
    }
    return () => controller.abort();
  }, [open, shootId, stableTargets]);
  return (value: string, serviceId?: string) => stableTargets
    .filter(target => !serviceId || target.serviceId === serviceId)
    .some(target => isTimeOutsideDayAvailability(days[keyOf(target)] ?? null, value));
}
