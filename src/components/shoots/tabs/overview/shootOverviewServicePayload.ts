import type { ShootData } from '@/types/shoots';
import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';
import {
  buildScheduledAtIso,
  deriveServiceCategoryName,
  formatDateForInput,
  formatTimeForInput,
} from './shootOverviewEditorSupport';
import type { ServiceOption, ServiceScheduleFields } from './shootOverviewEditorSupport';
import type {
  LegacyServiceItemRecord,
  OverviewServiceItemPayload,
  ShootOverviewUpdatePayload,
  ShootWithLegacyOverviewFields,
} from './shootOverviewUpdateTypes';

type ApplyOverviewServicePayloadArgs = {
  updates: ShootOverviewUpdatePayload;
  shoot: ShootData;
  isAdmin: boolean;
  omitStandardServices: boolean;
  selectedServiceIds: string[];
  serviceSchedules: Record<string, ServiceScheduleFields>;
  servicePrices: Record<string, string>;
  servicePhotographerPays: Record<string, string>;
  perCategoryPhotographers: Record<string, string>;
  servicesList: ServiceOption[];
};

/** Keeps all standard-service request keys together so Comp Mode can omit them atomically. */
export function applyOverviewServicePayload({
  updates,
  shoot,
  isAdmin,
  omitStandardServices,
  selectedServiceIds,
  serviceSchedules,
  servicePrices,
  servicePhotographerPays,
  perCategoryPhotographers,
  servicesList,
}: ApplyOverviewServicePayloadArgs) {
  if (omitStandardServices) {
    delete updates.service_items;
    delete updates.services;
    delete updates.service_photographers;
    return;
  }

  const legacyShoot = shoot as ShootWithLegacyOverviewFields;
  const orderSchedule = {
    date: formatDateForInput(updates.scheduledDate ?? shoot.scheduledDate),
    time: formatTimeForInput(String(updates.time ?? shoot.time ?? '')) || '10:00',
  };
  const existingScheduleByServiceId = new Map<string, ServiceScheduleFields>();
  [
    ...((legacyShoot.serviceItems as LegacyServiceItemRecord[] | undefined) || []),
    ...((legacyShoot.service_items as LegacyServiceItemRecord[] | undefined) || []),
    ...((shoot.serviceObjects as unknown as LegacyServiceItemRecord[] | undefined) || []),
  ].filter((item) => !isInvoiceAdjustmentServiceItem(item)).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const serviceId = item.service_id ?? item.serviceId ?? item.id;
    const scheduledAt = item.scheduled_at ?? item.scheduledAt;
    if (serviceId === null || serviceId === undefined || !scheduledAt) return;
    existingScheduleByServiceId.set(String(serviceId), {
      date: formatDateForInput(scheduledAt),
      time: formatTimeForInput(scheduledAt) || orderSchedule.time,
    });
  });

  const serviceItems = selectedServiceIds.map((serviceId) => {
    const savedSchedule = serviceSchedules[serviceId] || orderSchedule;
    const existingSchedule = existingScheduleByServiceId.get(serviceId);
    const schedule = existingSchedule
      && savedSchedule.date === orderSchedule.date
      && savedSchedule.time === orderSchedule.time
      ? existingSchedule
      : savedSchedule;
    const item: OverviewServiceItemPayload = {
      service_id: Number(serviceId),
      // An empty service date is intentionally kept unscheduled.
      scheduled_at: schedule.date ? buildScheduledAtIso(schedule.date, schedule.time) : null,
    };
    const explicitPrice = servicePrices[serviceId];
    if (isAdmin && explicitPrice !== undefined && explicitPrice !== '') {
      const parsedPrice = Number(explicitPrice);
      if (Number.isFinite(parsedPrice) && parsedPrice >= 0) item.price = parsedPrice;
    }
    if (servicePhotographerPays[serviceId]) {
      item.photographer_pay = parseFloat(servicePhotographerPays[serviceId]);
    }
    return item;
  });

  updates.service_items = serviceItems;
  updates.services = serviceItems.map((item) => ({
    id: item.service_id,
    ...(item.price !== undefined ? { price: item.price } : {}),
    ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
    scheduled_at: item.scheduled_at,
    photographer_pay: item.photographer_pay,
  }));
  updates.service_photographers = selectedServiceIds.flatMap((serviceId) => {
    const service = servicesList.find((option) => option.id === serviceId);
    if (!service) return [];
    const categoryKey = deriveServiceCategoryName(service).trim().toLowerCase().replace(/s$/, '');
    const photographerId = perCategoryPhotographers[categoryKey];
    return photographerId ? [{ service_id: Number(serviceId), photographer_id: Number(photographerId) }] : [];
  });
}
