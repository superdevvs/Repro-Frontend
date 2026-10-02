import type { Dispatch, SetStateAction } from 'react';
import type { MultiUnitBookingController } from '@/features/shoot-units/useMultiUnitBooking';
import type { TravelDurationAdjuster } from '@/features/travel/TravelDurationAdjustment';
import { serviceRequiresPhotographer } from '@/utils/photographerAssignment';
import { resolveServiceShootDuration, serviceDurationLimits } from '@/utils/shootDuration';
import type { ServicePackage, ServiceScheduleMap } from './bookShootModel';

type Options = {
  role?: string; impersonating: boolean; canOverride: boolean;
  services: ServicePackage[]; sqft?: number | null;
  schedules: ServiceScheduleMap; setSchedules: Dispatch<SetStateAction<ServiceScheduleMap>>;
  units: MultiUnitBookingController; onApplied: () => void;
};

/** Duration exceptions affect this proposed booking, never the service catalog. */
export function buildBookingDurationAdjuster(options: Options): TravelDurationAdjuster | undefined {
  if (options.impersonating || !options.canOverride
    || !['admin', 'superadmin', 'super_admin', 'salesrep', 'sales_rep', 'rep'].includes((options.role ?? '').toLowerCase())) return undefined;
  const { units } = options;
  const items = units.enabled ? units.schedule.lines.flatMap(line => {
    const service = units.catalog.find(item => item.id === line.service_id);
    if (!service || !serviceRequiresPhotographer(service)) return [];
    const unit = units.draft.units.find(item => item.client_key === line.unit_client_key);
    return [{ key: line.client_key, name: `${service.name} · ${unit?.label || 'Unit'}`,
      currentMinutes: line.duration_minutes ?? line.duration, ...serviceDurationLimits(service) }];
  }) : options.services.filter(serviceRequiresPhotographer).map(service => ({
    key: service.id, name: service.name,
    currentMinutes: resolveServiceShootDuration(service, options.sqft, options.schedules[service.id]?.duration_minutes),
    ...serviceDurationLimits(service),
  }));
  if (!items.length) return undefined;
  return { items, onApply: durations => {
    const valid = Object.entries(durations).filter(([key, minutes]) => {
      const item = items.find(candidate => candidate.key === key);
      return item && Number.isInteger(minutes) && minutes >= item.minMinutes && minutes <= item.maxMinutes
        && minutes !== item.currentMinutes;
    });
    if (!valid.length || valid.length !== Object.keys(durations).length) return;
    const changes = new Map(valid);
    if (units.enabled) units.setDraft(current => ({ ...current, lines: current.lines.map(line =>
      changes.has(line.client_key) ? { ...line, duration_minutes: changes.get(line.client_key)! } : line) }));
    else options.setSchedules(current => ({ ...current, ...Object.fromEntries(valid.map(([key, duration_minutes]) =>
      [key, { ...current[key], duration_minutes }])) }));
    options.onApplied();
  } };
}
