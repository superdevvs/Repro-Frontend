import { formatTimeForDisplay } from '@/utils/availabilityUtils';
import type { ServiceTimeOption } from './ServiceSchedulePicker';

// Approval retains early/late and exact-minute appointments; feasibility validates working hours.
export function buildFullDayServiceTimeOptions(ensure?: string | null): ServiceTimeOption[] {
  const values = Array.from({ length: 1440 }, (_, index) => `${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`);
  if (ensure && !values.includes(ensure)) values.push(ensure);
  return values.sort().map(value => ({ value, label: formatTimeForDisplay(value) }));
}
