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
import { bookingPrimarySchedule } from '@/utils/bookingPrimarySchedule';
import { getShootSchedule } from '@/utils/shootSchedule';

type Options = {
  active: boolean; requestedOnly: boolean; shootId?: string | null; clientId?: string | number;
  address: string; city: string; state: string; zip: string; date?: Date; time: string; photographer: string;
  propertyDetails: unknown; sqft?: number | null; source?: { timezone?: string | null; scheduled_at?: string | null } | null;
  selectedServices: ServicePackage[]; servicePhotographers: Record<string, string>;
  serviceSchedules: Record<string, { date?: string; time?: string; duration_minutes?: number }>;
  unitPayload?: (timezone: string) => TravelPayload;
  photographers?: Array<{ id: string; name: string }>;
  initialNotifications?: { client: boolean; photographer: boolean };
  onNotificationsChange?: (value: { client: boolean; photographer: boolean }) => void;
  onScheduleChange?: (change: ScheduleChange) => void;
};
export function useBookingTravel(options: Options) {
  const { active, requestedOnly, shootId, clientId, address, city, state, zip, date, time, photographer,
    propertyDetails, sqft, source, selectedServices, servicePhotographers, serviceSchedules, unitPayload } = options;
  const timezone = resolveBookingTimezone({ isEditMode: Boolean(shootId), storedTimezone: source?.timezone,
    browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const day = date ? format(date, 'yyyy-MM-dd') : '';
  const primary = bookingPrimarySchedule(selectedServices, serviceSchedules, date, time, photographer, servicePhotographers);
  const unitData = unitPayload ? safelyBuildTravelPayload(() => unitPayload(timezone)) : null;
  const unitLines = Array.isArray(unitData?.service_lines) ? unitData.service_lines as Array<{ photographer_id?: string | number | null; scheduled_at?: string }> : [];
  const unitPrimary = unitLines.find(line => line.photographer_id) ?? unitLines[0];
  const unitClock = unitPrimary ? getShootSchedule({ scheduled_at: unitPrimary.scheduled_at, timezone }) : null;
  const scheduledTime = toBackendTime(unitClock?.time ?? primary.time);
  const scheduledDay = unitClock?.date ?? primary.date;
  const hasCapture = unitPayload ? unitLines.some(line => line.photographer_id) : selectedServices.some(service => service.photographer_required !== false);
  const completeRows = unitPayload ? unitLines.length > 0 && unitLines.every(line => line.scheduled_at)
    : selectedServices.every(service => (serviceSchedules[service.id]?.date ?? day) && (serviceSchedules[service.id]?.time ?? time));
  const payload = safelyBuildTravelPayload(() => active && hasCapture && completeRows && scheduledDay && scheduledTime && address ? {
    ...(shootId ? { shoot_id: shootId } : {}), client_id: clientId, address, city, state, zip,
    ...(propertyDetails ? { property_details: propertyDetails } : {}), timezone, photographer_id: unitPrimary?.photographer_id ?? primary.photographer,
    scheduled_at: buildShootScheduleTimestamp(scheduledDay, scheduledTime, timezone, source?.scheduled_at),
    action_mode: shootId ? 'update' : 'create',
    ...(unitPayload ? unitData : { service_items: selectedServices.map(service => ({
      service_id: service.id, quantity: service.quantity ?? 1,
      service_name: service.name,
      photographer_name: options.photographers?.find(person => String(person.id) === String(resolveServicePhotographerId(service, servicePhotographers, photographer)))?.name,
      duration_minutes: resolveServiceShootDuration(service, sqft, serviceSchedules[service.id]?.duration_minutes),
      photographer_id: resolveServicePhotographerId(service, servicePhotographers, photographer),
      scheduled_at: buildBookShootServiceSchedule(service.id, serviceSchedules, day, time, { ...source, timezone }),
    })) }),
  } : null);
  return useTravelFeasibility({ payload, requestedOnly, initialNotifications: options.initialNotifications, onNotificationsChange: options.onNotificationsChange, notificationsSupported: !requestedOnly, onScheduleChange: unitPayload ? undefined : options.onScheduleChange });
}
