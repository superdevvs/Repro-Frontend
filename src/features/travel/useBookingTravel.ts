import { format } from 'date-fns';
import { toBackendTime, type ServicePackage } from '@/pages/bookShootModel';
import { resolveBookingTimezone } from '@/pages/bookShootTimezone';
import { buildBookShootServiceSchedule } from '@/pages/bookShootServiceSchedule';
import { resolveServicePhotographerId } from '@/utils/photographerAssignment';
import { resolveServiceShootDuration } from '@/utils/shootDuration';
import { buildShootScheduleTimestamp } from '@/utils/shootScheduleSubmission';
import { useTravelFeasibility } from './useTravelFeasibility';
import type { TravelPayload } from './types';
import { safelyBuildTravelPayload } from './travelPayload';
import type { ScheduleChange } from './daySchedule';

type Options = {
  active: boolean; requestedOnly: boolean; shootId?: string | null; clientId?: string | number;
  address: string; city: string; state: string; zip: string; date?: Date; time: string; photographer: string;
  propertyDetails: unknown; sqft?: number | null; source?: { timezone?: string | null; scheduled_at?: string | null } | null;
  selectedServices: ServicePackage[]; servicePhotographers: Record<string, string>;
  serviceSchedules: Record<string, { date?: string; time?: string; duration_minutes?: number }>;
  unitPayload?: (timezone: string) => TravelPayload;
  onScheduleChange?: (change: ScheduleChange) => void;
};
export function useBookingTravel(options: Options) {
  const { active, requestedOnly, shootId, clientId, address, city, state, zip, date, time, photographer,
    propertyDetails, sqft, source, selectedServices, servicePhotographers, serviceSchedules, unitPayload } = options;
  const timezone = resolveBookingTimezone({ isEditMode: Boolean(shootId), storedTimezone: source?.timezone,
    browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const day = date ? format(date, 'yyyy-MM-dd') : '';
  const scheduledTime = toBackendTime(time);
  const payload = safelyBuildTravelPayload(() => active && day && scheduledTime && address ? {
    ...(shootId ? { shoot_id: shootId } : {}), client_id: clientId, address, city, state, zip,
    property_details: propertyDetails, timezone, photographer_id: photographer || null,
    scheduled_at: buildShootScheduleTimestamp(day, scheduledTime, timezone, source?.scheduled_at),
    action_mode: shootId ? 'update' : 'create',
    ...(unitPayload ? unitPayload(timezone) : { service_items: selectedServices.map(service => ({
      service_id: service.id, quantity: service.quantity ?? 1,
      duration_minutes: resolveServiceShootDuration(service, sqft, serviceSchedules[service.id]?.duration_minutes),
      photographer_id: resolveServicePhotographerId(service, servicePhotographers, photographer),
      scheduled_at: buildBookShootServiceSchedule(service.id, serviceSchedules, day, time, { ...source, timezone }),
    })) }),
  } : null);
  return useTravelFeasibility({ payload, requestedOnly, notificationsSupported: !requestedOnly, onScheduleChange: unitPayload ? undefined : options.onScheduleChange });
}
