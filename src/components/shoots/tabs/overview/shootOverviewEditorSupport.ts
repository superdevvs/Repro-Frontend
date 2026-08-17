import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import { format, isValid, parse } from 'date-fns';
import axios from 'axios';
import type { ShootData } from '@/types/shoots';
import { API_BASE_URL } from '@/config/env';
import API_ROUTES from '@/lib/api';
import { calculateDistance, getCoordinatesFromAddress } from '@/utils/distanceUtils';
import { to12Hour } from '@/utils/availabilityUtils';
import { buildNormalizedPropertyDetails } from '@/utils/addressLookup';
import { isInvoiceAdjustmentServiceItem } from '@/utils/shootServiceItems';
import {
  buildWallClockIso,
  formatDateForWallClockInput,
  formatTimeForWallClockInput,
} from '@/utils/wallClockDateTime';

export type PresenceOption = 'self' | 'other' | 'lockbox';

export type ServiceOption = {
  id: string;
  name: string;
  price?: number;
  pricing_type?: 'fixed' | 'variable';
  allow_multiple?: boolean;
  sqft_ranges?: Array<{ sqft_from: number; sqft_to: number; duration: number | null; price: number; photographer_pay: number | null }>;
  description?: string;
  category?: { id?: string; name?: string } | string | null;
  photographer_pay?: number | null;
  duration?: number | null;
  [key: string]: unknown;
};

export type ServiceCategoryOption = {
  id: string;
  name: string;
  count: number;
};

export type ServiceScheduleFields = {
  date: string;
  time: string;
};

export type PhotographerPickerContext = {
  source: 'edit';
  categoryKey?: string;
  categoryName?: string;
} | null;

export type AddressDetailsForLookup = {
  formatted_address?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  property_details?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
};

export type PhotographerPickerOption = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  distance?: number;
  distanceFrom?: 'home' | 'previous_shoot';
  previousShootId?: number;
  originAddress?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  availabilitySlots?: Array<{ start_time: string; end_time: string; status?: string }>;
  netAvailableSlots?: Array<{ start_time: string; end_time: string; status?: string }>;
  bookedSlots?: Array<{ start_time: string; end_time: string; status?: string }>;
  unavailableSlots?: Array<{ start_time: string; end_time: string; status?: string }>;
  hasAvailability?: boolean;
  shootsCountToday?: number;
};

export type ClientOption = {
  id: string;
  name: string;
  email: string;
  company?: string;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === 'object' ? value as UnknownRecord : {};

const asRecordArray = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const optionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const responseItems = (value: unknown): unknown[] => {
  const payload = asRecord(value).data ?? value;
  return Array.isArray(payload) ? payload : [];
};

const normalizeSlots = (value: unknown): NonNullable<PhotographerPickerOption['availabilitySlots']> =>
  asRecordArray(value).flatMap((slot) => {
    const startTime = optionalString(slot.start_time);
    const endTime = optionalString(slot.end_time);
    if (!startTime || !endTime) return [];
    return [{
      start_time: startTime,
      end_time: endTime,
      status: optionalString(slot.status),
    }];
  });

export type UseShootOverviewEditorArgs = {
  shoot: ShootData;
  isAdmin: boolean;
  role: string;
  isEditMode?: boolean;
  onShootUpdate: () => void;
  onSave?: (updates: Partial<ShootData>) => void;
  onCancel?: () => void;
  onRegisterEditActions?: (actions: { save: () => void; cancel: () => void }) => void;
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
};

const FLEXIBLE_DATE_FORMATS = [
  'dd-MM-yyyy',
  'MM-dd-yyyy',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'yyyy/MM/dd',
  'yyyy.MM.dd',
  'dd.MM.yyyy',
];

const parseFlexibleDate = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    const parsedDate = new Date(timestamp);
    if (isValid(parsedDate)) return parsedDate;
  }
  for (const formatString of FLEXIBLE_DATE_FORMATS) {
    try {
      const parsedDate = parse(trimmed, formatString, new Date());
      if (isValid(parsedDate)) return parsedDate;
    } catch {
      // Ignore invalid matches and continue through the fallback formats.
    }
  }
  return null;
};

export const formatDateForInput = (dateString?: string | null) => {
  if (!dateString) return format(new Date(), 'yyyy-MM-dd');
  const wallClockDate = formatDateForWallClockInput(dateString);
  if (wallClockDate) return wallClockDate;
  try {
    const parsedDate = parseFlexibleDate(dateString);
    if (!parsedDate) return format(new Date(), 'yyyy-MM-dd');
    return format(parsedDate, 'yyyy-MM-dd');
  } catch {
    return format(new Date(), 'yyyy-MM-dd');
  }
};

// Format a date for an <input type="date"> ONLY when a real value is present.
// Unlike `formatDateForInput`, this never fabricates today's date for a
// missing/unparseable value - it returns an empty string so unscheduled
// services render as UNASSIGNED ("Select date") instead of a fake date.
const formatDateForInputOrEmpty = (dateString?: string | null) => {
  if (!dateString) return '';
  const wallClockDate = formatDateForWallClockInput(dateString);
  if (wallClockDate) return wallClockDate;
  try {
    const parsedDate = parseFlexibleDate(dateString);
    return parsedDate ? format(parsedDate, 'yyyy-MM-dd') : '';
  } catch {
    return '';
  }
};

// Build the per-service schedule fields from a raw `scheduled_at`. When there is
// no value the schedule stays EMPTY (date + time both ''), which the
// ServiceDatePicker/ServiceTimePicker render as "Select date"/"Select time".
export const buildServiceScheduleFields = (scheduledAt?: string | null): ServiceScheduleFields => {
  const date = formatDateForInputOrEmpty(scheduledAt);
  if (!date) return { date: '', time: '' };
  return { date, time: formatTimeForInput(scheduledAt) || '10:00' };
};

export const formatTimeForInput = (value?: string | null) => {
  if (!value) return '';
  const wallClockTime = formatTimeForWallClockInput(value);
  if (wallClockTime) return wallClockTime;

  const parsedDate = parseFlexibleDate(value);
  if (parsedDate) return format(parsedDate, 'HH:mm');

  const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})/);
  if (!hhmmMatch) return '';
  const hours = Number(hhmmMatch[1]);
  const minutes = Number(hhmmMatch[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const buildScheduledAtIso = (dateValue?: string, timeValue?: string) => {
  return buildWallClockIso(dateValue, timeValue || '10:00');
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'uncategorized';

const normalizeDayOfWeek = (value: unknown): string => {
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

const normalizeCategoryName = (value?: string) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'photo' || normalized === 'photos') return 'photos';
  return normalized;
};

export const deriveServiceCategoryId = (service: ServiceOption) => {
  const categoryName = typeof service.category === 'string' ? service.category : service.category?.name;
  const normalizedName = normalizeCategoryName(categoryName);
  if (normalizedName === 'photos') return 'photos';
  if (!service.category) return 'uncategorized';
  if (typeof service.category === 'string') return slugify(normalizedName || service.category);
  if (service.category.id) return String(service.category.id);
  if (service.category.name) return slugify(normalizedName || service.category.name);
  return 'uncategorized';
};

export const deriveServiceCategoryName = (service: ServiceOption) => {
  const categoryName = typeof service.category === 'string' ? service.category : service.category?.name;
  const normalizedName = normalizeCategoryName(categoryName);
  if (normalizedName === 'photos') return 'Photos';
  if (!service.category) return 'Uncategorized';
  if (typeof service.category === 'string') return service.category;
  return service.category.name || 'Uncategorized';
};

export const mapPhotographerPickerOption = (value: unknown): PhotographerPickerOption => {
  const photographer = asRecord(value);
  const metadata = asRecord(photographer.metadata);
  const origin = asRecord(photographer.originAddress ?? photographer.origin_address);
  const distanceFrom = photographer.distanceFrom ?? photographer.distance_from;
  return {
    id: String(photographer.id ?? ''),
    name: optionalString(photographer.name) || 'Unknown',
    email: optionalString(photographer.email) || '',
    avatar: optionalString(photographer.avatar)
      || optionalString(photographer.profile_image)
      || optionalString(photographer.profile_photo_url),
    address: optionalString(photographer.address)
      || optionalString(metadata.address)
      || optionalString(metadata.homeAddress),
    city: optionalString(photographer.city) || optionalString(metadata.city),
    state: optionalString(photographer.state) || optionalString(metadata.state),
    zip: optionalString(photographer.zip) || optionalString(photographer.zipcode)
      || optionalString(metadata.zip) || optionalString(metadata.zipcode),
    distance: optionalNumber(photographer.distance),
    distanceFrom: distanceFrom === 'home' || distanceFrom === 'previous_shoot' ? distanceFrom : undefined,
    previousShootId: optionalNumber(photographer.previousShootId ?? photographer.previous_shoot_id),
    originAddress: Object.keys(origin).length ? {
      address: optionalString(origin.address),
      city: optionalString(origin.city),
      state: optionalString(origin.state),
      zip: optionalString(origin.zip),
    } : undefined,
    availabilitySlots: normalizeSlots(photographer.availabilitySlots ?? photographer.availability_slots),
    netAvailableSlots: normalizeSlots(photographer.netAvailableSlots ?? photographer.net_available_slots),
    bookedSlots: normalizeSlots(photographer.bookedSlots ?? photographer.booked_slots),
    unavailableSlots: normalizeSlots(photographer.unavailableSlots ?? photographer.unavailable_slots),
    hasAvailability: Boolean(photographer.hasAvailability ?? photographer.has_availability),
    shootsCountToday: optionalNumber(photographer.shootsCountToday ?? photographer.shoots_count_today),
  };
};

const mergePhotographerPickerOption = (
  base: PhotographerPickerOption,
  enriched?: PhotographerPickerOption,
): PhotographerPickerOption => ({
  ...base,
  ...(enriched || {}),
  name: enriched?.name || base.name,
  email: enriched?.email || base.email,
  avatar: enriched?.avatar || base.avatar,
  address: enriched?.address || base.address,
  city: enriched?.city || base.city,
  state: enriched?.state || base.state,
  zip: enriched?.zip || base.zip,
});

const loadPhotographerPickerOptions = async (): Promise<PhotographerPickerOption[]> => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
    const data = response.data?.data || response.data || [];
    const formatted = Array.isArray(data) ? data.map(mapPhotographerPickerOption) : [];
    if (formatted.length > 0) return formatted;
  } catch (error) {
    console.warn('[ShootDetailsOverviewTab] Admin photographers endpoint failed, falling back to public list:', error);
  }

  try {
    const response = await axios.get(API_ROUTES.people.photographers);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(mapPhotographerPickerOption) : [];
  } catch (error) {
    console.error('[ShootDetailsOverviewTab] Public photographers endpoint failed:', error);
    return [];
  }
};

export const toNumberOrUndefined = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return undefined;
  const parsedValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

export const formatEditableValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isNaN(numeric) ? String(value) : String(numeric);
};

export const deriveMetricsFromAddress = (details: AddressDetailsForLookup) => {
  const propertyDetails = asRecord(details.property_details);
  const detailsRecord = asRecord(details);
  const bedrooms = details.bedrooms ?? propertyDetails.beds ?? propertyDetails.bedrooms ?? propertyDetails.bed;
  const bathrooms = details.bathrooms ?? detailsRecord.baths
    ?? propertyDetails.baths ?? propertyDetails.bathrooms ?? propertyDetails.bath;
  const sqft = details.sqft ?? propertyDetails.sqft ?? propertyDetails.livingArea
    ?? propertyDetails.living_area ?? propertyDetails.squareFeet ?? propertyDetails.square_feet;
  return { bedrooms, bathrooms, sqft };
};

export const extractLookupPropertyDetails = (details: AddressDetailsForLookup) =>
  buildNormalizedPropertyDetails({
    ...details,
    property_details:
      details.property_details && typeof details.property_details === 'object'
        ? details.property_details
        : {},
  });

const normalizeServiceOption = (value: unknown): ServiceOption | null => {
  const service = asRecord(value);
  if (service.id === null || service.id === undefined || typeof service.name !== 'string') return null;
  const rawRanges = service.sqft_ranges ?? service.sqftRanges;
  const ranges = asRecordArray(rawRanges).flatMap((range) => {
    const sqftFrom = optionalNumber(range.sqft_from);
    const sqftTo = optionalNumber(range.sqft_to);
    if (sqftFrom === undefined || sqftTo === undefined) return [];
    return [{
      sqft_from: sqftFrom,
      sqft_to: sqftTo,
      price: optionalNumber(range.price) ?? 0,
      photographer_pay: optionalNumber(range.photographer_pay) ?? null,
      duration: optionalNumber(range.duration) ?? null,
    }];
  });
  const categoryValue = service.category ?? service.service_category;
  const categoryRecord = asRecord(categoryValue);
  const category = typeof categoryValue === 'string'
    ? categoryValue
    : Object.keys(categoryRecord).length
      ? {
          id: categoryRecord.id === null || categoryRecord.id === undefined
            ? undefined
            : String(categoryRecord.id),
          name: optionalString(categoryRecord.name),
        }
      : null;
  return {
    id: String(service.id),
    name: service.name,
    price: optionalNumber(service.price) ?? 0,
    pricing_type: service.pricing_type === 'variable' ? 'variable' : 'fixed',
    allow_multiple: Boolean(service.allow_multiple),
    sqft_ranges: ranges,
    category,
    description: optionalString(service.description) || '',
    photographer_pay: optionalNumber(service.photographer_pay) ?? null,
    duration: optionalNumber(service.duration) ?? null,
  };
};

const mergeServiceItemRecords = (itemValue: unknown, serviceObjectValue?: unknown): UnknownRecord => {
  const item = asRecord(itemValue);
  const serviceObject = asRecord(serviceObjectValue);
  return {
    ...serviceObject,
    ...item,
    scheduled_at: item.scheduled_at ?? item.scheduledAt
      ?? serviceObject.scheduled_at ?? serviceObject.scheduledAt,
    scheduledAt: item.scheduledAt ?? item.scheduled_at
      ?? serviceObject.scheduledAt ?? serviceObject.scheduled_at,
  };
};

export function useOverviewLookupData(
  isEditMode: boolean,
  shoot: ShootData,
  effectiveSqft: number | null,
  resolveServicePrice: (service: ServiceOption, sqft: number | null, overrideValue?: string) => { price: number; basePrice: number; hasOverride: boolean },
  setClients: Dispatch<SetStateAction<ClientOption[]>>,
  setServicesList: Dispatch<SetStateAction<ServiceOption[]>>,
  setSelectedServiceIds: Dispatch<SetStateAction<string[]>>,
  setServicePrices: Dispatch<SetStateAction<Record<string, string>>>,
  setServicePhotographerPays: Dispatch<SetStateAction<Record<string, string>>>,
  setServiceSchedules: Dispatch<SetStateAction<Record<string, ServiceScheduleFields>>>,
  setEditPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
) {
  useEffect(() => {
    if (!isEditMode) return;

    const fetchClients = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/admin/clients`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!response.ok) return;
        const json: unknown = await response.json();
        const clientsList = responseItems(json).flatMap((value): ClientOption[] => {
          const client = asRecord(value);
          if (client.id === null || client.id === undefined || typeof client.name !== 'string') return [];
          return [{
            id: String(client.id),
            name: client.name,
            email: optionalString(client.email) || '',
            company: optionalString(client.company_name) || optionalString(client.company) || '',
          }];
        });
        const currentClient = shoot.client;
        if (currentClient && !clientsList.some((client: ClientOption) => client.id === String(currentClient.id))) {
          clientsList.unshift({
            id: String(currentClient.id),
            name: currentClient.name || 'Current client',
            email: currentClient.email || '',
            company: currentClient.company || '',
          });
        }
        setClients(clientsList);
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };

    const fetchServices = async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/services`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!response.ok) return;
        const json: unknown = await response.json();
        const servicesData = responseItems(json)
          .map(normalizeServiceOption)
          .filter((service): service is ServiceOption => service !== null);

        const allRawServiceItems = Array.isArray(shoot.serviceItems)
          ? shoot.serviceItems.map(asRecord)
          : Array.isArray(shoot.service_items)
            ? shoot.service_items.map(asRecord)
            : [];
        const rawServiceItems = allRawServiceItems
          .filter((item) => !isInvoiceAdjustmentServiceItem(item));
        const hasStructuredServiceItems = allRawServiceItems.length > 0;
        const serviceObjectsById = new Map<string, UnknownRecord>();
        (shoot.serviceObjects || []).forEach((value) => {
          const serviceObject = asRecord(value);
          if (isInvoiceAdjustmentServiceItem(serviceObject)) return;
          const id = serviceObject.service_id ?? serviceObject.serviceId ?? serviceObject.id;
          if (id !== null && id !== undefined) serviceObjectsById.set(String(id), serviceObject);
        });
        const hydratedServiceItems = rawServiceItems.map((item) => {
          const id = item.service_id ?? item.serviceId ?? item.id;
          const serviceObject = id !== null && id !== undefined ? serviceObjectsById.get(String(id)) : undefined;
          return serviceObject ? mergeServiceItemRecords(item, serviceObject) : item;
        });
        const serviceSource: unknown[] = hasStructuredServiceItems
          ? hydratedServiceItems
          : shoot.serviceObjects && shoot.serviceObjects.length > 0
            ? shoot.serviceObjects.filter((item) => !isInvoiceAdjustmentServiceItem(item))
            : (Array.isArray(shoot.services) ? shoot.services : []);
        const mergedServicesById = new Map<string, ServiceOption>();
        servicesData.forEach((service: ServiceOption) => {
          mergedServicesById.set(service.id, service);
        });
        serviceSource.forEach((value) => {
          const service = asRecord(value);
          const rawServiceId = service.service_id ?? service.serviceId ?? service.id;
          if (rawServiceId === null || rawServiceId === undefined) return;
          const serviceId = String(rawServiceId);
          if (mergedServicesById.has(serviceId)) return;
          const serviceName = service.name ?? service.service_name ?? service.serviceName;
          if (!serviceName) return;
          const normalizedService = normalizeServiceOption({
            ...service,
            id: serviceId,
            name: String(serviceName),
            price: service.price ?? service.subtotal ?? 0,
          });
          if (normalizedService) mergedServicesById.set(serviceId, normalizedService);
        });
        const mergedServices = Array.from(mergedServicesById.values());
        setServicesList(mergedServices);

        if (serviceSource.length === 0 || mergedServices.length === 0) return;

        const currentServiceIds = serviceSource
          .map((value) => {
            if (typeof value === 'string') {
              const foundService = servicesData.find((serviceOption) => serviceOption.name === value);
              return foundService ? foundService.id : null;
            }
            if (value && typeof value === 'object') {
              const service = asRecord(value);
              return String(service.service_id || service.serviceId || service.id || '');
            }
            return null;
          })
          .filter(Boolean) as string[];

        setSelectedServiceIds(currentServiceIds);

        const nextPrices: Record<string, string> = {};
        const nextPhotographerPays: Record<string, string> = {};
        const nextServiceSchedules: Record<string, ServiceScheduleFields> = {};
        const scheduleByServiceId = new Map<string, ServiceScheduleFields>();
        rawServiceItems.forEach((item) => {
          if (!item || typeof item !== 'object') return;
          const serviceId = item.service_id ?? item.serviceId;
          if (serviceId === null || serviceId === undefined) return;
          const scheduledAt = item.scheduled_at ?? item.scheduledAt;
          scheduleByServiceId.set(String(serviceId), buildServiceScheduleFields(optionalString(scheduledAt)));
        });
        serviceSource.forEach((value) => {
          if (!value || typeof value !== 'object') return;
          const service = asRecord(value);
          const serviceId = String(service.service_id || service.serviceId || service.id || '');
          if (!serviceId || !currentServiceIds.includes(serviceId)) return;
          const serviceScheduledAt = service.scheduled_at ?? service.scheduledAt;
          nextServiceSchedules[serviceId] =
            scheduleByServiceId.get(serviceId) || buildServiceScheduleFields(optionalString(serviceScheduledAt));
          const serviceRecord = mergedServices.find((serviceOption: ServiceOption) => serviceOption.id === serviceId);
          const basePrice = serviceRecord
            ? resolveServicePrice(serviceRecord, effectiveSqft).basePrice
            : Number(service.price ?? 0);
          const normalizedBasePrice = Number.isFinite(basePrice) ? basePrice : 0;
          const parsedPrice = service.price === null || service.price === undefined || service.price === ''
            ? NaN
            : Number(service.price);
          const shouldUsePrice = Number.isFinite(parsedPrice)
            && (
              (normalizedBasePrice === 0 && parsedPrice > 0)
              || (normalizedBasePrice > 0 && Math.abs(parsedPrice - normalizedBasePrice) > 0.01)
            );
          if (shouldUsePrice) nextPrices[serviceId] = String(parsedPrice);
          if (service.photographer_pay !== undefined && service.photographer_pay !== null) {
            nextPhotographerPays[serviceId] = String(service.photographer_pay);
          }
        });
        setServicePrices(nextPrices);
        setServicePhotographerPays(nextPhotographerPays);
        setServiceSchedules(nextServiceSchedules);
      } catch (error) {
        console.error('Error fetching services:', error);
      }
    };

    const fetchPhotographers = async () => {
      try {
        const photographersList = await loadPhotographerPickerOptions();
        const nextPhotographers = [...photographersList];
        const currentPhotographer = shoot.photographer;
        if (currentPhotographer && !nextPhotographers.some((photographer) => photographer.id === String(currentPhotographer.id))) {
          nextPhotographers.unshift(mapPhotographerPickerOption(currentPhotographer));
        }
        setEditPhotographers(nextPhotographers);
      } catch (error) {
        console.error('Error fetching photographers:', error);
        setEditPhotographers([]);
      }
    };

    fetchClients();
    fetchServices();
    fetchPhotographers();
  }, [
    effectiveSqft,
    isEditMode,
    resolveServicePrice,
    setClients,
    setEditPhotographers,
    setSelectedServiceIds,
    setServicePhotographerPays,
    setServicePrices,
    setServiceSchedules,
    setServicesList,
    shoot,
  ]);
}

export function usePhotographerAssignmentOptions(
  assignPhotographerOpen: boolean,
  editPhotographers: PhotographerPickerOption[],
  isAdminOrRep: boolean,
  isEditMode: boolean,
  setPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
  setEditPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
) {
  useEffect(() => {
    if (!assignPhotographerOpen) return;

    if (editPhotographers.length > 0) {
      setPhotographers((current) => current.length > 0 ? current : editPhotographers.map((photographer) => ({ ...photographer })));
    }

    if (!isAdminOrRep && !isEditMode) return;

    const fetchPhotographers = async () => {
      try {
        const photographersList = await loadPhotographerPickerOptions();
        if (photographersList.length > 0) {
          setPhotographers((current) => {
            if (current.length === 0) return photographersList;
            const currentById = new Map(current.map((photographer) => [String(photographer.id), photographer]));
            return photographersList.map((photographer) =>
              mergePhotographerPickerOption(photographer, currentById.get(String(photographer.id))),
            );
          });
          setEditPhotographers((current) => current.length > 0 ? current : photographersList);
        }
      } catch (error) {
        console.error('Error fetching photographers:', error);
      }
    };

    fetchPhotographers();
  }, [assignPhotographerOpen, editPhotographers, isAdminOrRep, isEditMode, setEditPhotographers, setPhotographers]);
}

export function usePhotographerDistanceAvailability(
  assignPhotographerOpen: boolean,
  photographers: PhotographerPickerOption[],
  isAdminOrRep: boolean,
  getShootLocation: () => { address: string; city: string; state: string; zip: string },
  scheduleDate: string,
  scheduleTime: string,
  setPhotographers: Dispatch<SetStateAction<PhotographerPickerOption[]>>,
  setIsCalculatingDistances: Dispatch<SetStateAction<boolean>>,
  setIsLoadingAvailability: Dispatch<SetStateAction<boolean>>,
) {
  const shootLocation = getShootLocation();
  const shootLocationKey = [
    shootLocation.address,
    shootLocation.city,
    shootLocation.state,
    shootLocation.zip,
  ].join('|');
  const photographerDistanceKey = photographers
    .map((photographer) => [
      photographer.id,
      photographer.originAddress?.address || photographer.address || '',
      photographer.originAddress?.city || photographer.city || '',
      photographer.originAddress?.state || photographer.state || '',
      photographer.originAddress?.zip || photographer.zip || '',
    ].join('|'))
    .join('::');
  const photographerAvailabilityKey = photographers
    .map((photographer) => String(photographer.id))
    .join(',');

  useEffect(() => {
    const calculateDistances = async () => {
      if (!assignPhotographerOpen || photographers.length === 0) return;
      if (!shootLocation.address || !shootLocation.city || !shootLocation.state) return;
      if (photographers.every((photographer) => photographer.distance !== undefined)) return;

      setIsCalculatingDistances(true);
      try {
        const shootCoords = await getCoordinatesFromAddress(
          shootLocation.address,
          shootLocation.city,
          shootLocation.state,
          shootLocation.zip,
        );
        if (!shootCoords) return;

        const distanceUpdates = await Promise.all(
          photographers.map(async (photographer) => {
            if (photographer.distance !== undefined && photographer.originAddress) {
              return { id: photographer.id, distance: photographer.distance };
            }

            const sourceAddress = photographer.originAddress?.address || photographer.address;
            const sourceCity = photographer.originAddress?.city || photographer.city;
            const sourceState = photographer.originAddress?.state || photographer.state;
            const sourceZip = photographer.originAddress?.zip || photographer.zip;

            if (!sourceAddress || !sourceCity || !sourceState) {
              return null;
            }

            const photographerCoords = await getCoordinatesFromAddress(
              sourceAddress,
              sourceCity,
              sourceState,
              sourceZip,
            );
            if (!photographerCoords) {
              return null;
            }

            const distance = calculateDistance(
              shootCoords.lat,
              shootCoords.lon,
              photographerCoords.lat,
              photographerCoords.lon,
            );

            return { id: photographer.id, distance: Math.round(distance * 10) / 10 };
          }),
        );

        const distanceById = new Map(
          distanceUpdates
            .filter((item): item is { id: string; distance: number } =>
              Boolean(item && Number.isFinite(item.distance)),
            )
            .map((item) => [String(item.id), item.distance]),
        );
        if (distanceById.size === 0) return;

        setPhotographers((current) => current.map((photographer) => {
          const distance = distanceById.get(String(photographer.id));
          return distance === undefined ? photographer : { ...photographer, distance };
        }));
      } catch (error) {
        console.error('Error calculating distances:', error);
      } finally {
        setIsCalculatingDistances(false);
      }
    };

    calculateDistances();
  }, [
    assignPhotographerOpen,
    photographerDistanceKey,
    setIsCalculatingDistances,
    setPhotographers,
    shootLocationKey,
  ]);

  useEffect(() => {
    if (!assignPhotographerOpen || photographers.length === 0) return;
    if (!shootLocation.address || !shootLocation.city || !shootLocation.state) return;

    let cancelled = false;
    const controller = new AbortController();

    const fetchAvailability = async () => {
      setIsLoadingAvailability(true);
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(API_ROUTES.photographerAvailability.forBooking, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            date: scheduleDate || format(new Date(), 'yyyy-MM-dd'),
            time: to12Hour(scheduleTime || '10:00'),
            shoot_address: shootLocation.address,
            shoot_city: shootLocation.city,
            shoot_state: shootLocation.state,
            shoot_zip: shootLocation.zip || '',
            photographer_ids: photographers.map((photographer) => Number(photographer.id)),
          }),
        });

        if (!response.ok) throw new Error('Failed to load availability');
        const json = await response.json();
        if (cancelled) return;
        const availabilityList = Array.isArray(json.data) ? json.data : [];
        let rawAvailabilityByPhotographer: Record<string, any[]> = {};
        try {
          const bulkResponse = await fetch(API_ROUTES.photographerAvailability.bulkIndex, {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              photographer_ids: photographers.map((photographer) => Number(photographer.id)),
              from_date: scheduleDate || format(new Date(), 'yyyy-MM-dd'),
              to_date: scheduleDate || format(new Date(), 'yyyy-MM-dd'),
            }),
          });
          if (bulkResponse.ok) {
            const bulkJson = await bulkResponse.json();
            rawAvailabilityByPhotographer = bulkJson?.data || {};
          }
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            console.error('Error fetching raw photographer availability:', error);
          }
        }
        const dateStr = scheduleDate || format(new Date(), 'yyyy-MM-dd');
        const parsedScheduleDate = parseFlexibleDate(dateStr);
        const dayOfWeek = parsedScheduleDate
          ? parsedScheduleDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
          : '';

        setPhotographers((current) => current.map((photographer) => {
          const match = availabilityList.find((item: any) => String(item.id) === String(photographer.id));
          const rawSlots = rawAvailabilityByPhotographer[photographer.id] || rawAvailabilityByPhotographer[String(photographer.id)] || [];
          const specificDateSlots = rawSlots.filter((slot: any) => {
            const slotDate = slot?.date ? String(slot.date).slice(0, 10) : '';
            return slotDate === dateStr;
          });
          const weeklySlots = rawSlots.filter((slot: any) => {
            const slotDate = slot?.date ? String(slot.date).trim() : '';
            if (slotDate) return false;
            return normalizeDayOfWeek(slot?.day_of_week) === dayOfWeek;
          });
          const relevantSlots = specificDateSlots.length > 0 ? specificDateSlots : weeklySlots;
          const rawAvailableSlots = relevantSlots
            .filter((slot: any) => !slot.status || slot.status === 'available')
            .map((slot: any) => ({
              start_time: slot.start_time,
              end_time: slot.end_time,
            }));
          if (!match) {
            return {
              ...photographer,
              availabilitySlots: rawAvailableSlots.length > 0 ? rawAvailableSlots : photographer.availabilitySlots,
              netAvailableSlots: rawAvailableSlots.length > 0 ? rawAvailableSlots : photographer.netAvailableSlots,
              hasAvailability: rawAvailableSlots.length > 0 ? true : photographer.hasAvailability,
            };
          }
          const parsedDistance = typeof match.distance === 'number'
            ? match.distance
            : match.distance
            ? Number(match.distance)
            : match.distance_miles
            ? Number(match.distance_miles)
            : photographer.distance;
          const matchNetSlots = match.net_available_slots ?? photographer.netAvailableSlots;
          const nextAvailableSlots = rawAvailableSlots.length > 0 ? rawAvailableSlots : (match.availability_slots ?? photographer.availabilitySlots);
          const nextNetSlots = rawAvailableSlots.length > 0 ? rawAvailableSlots : matchNetSlots;
          return {
            ...photographer,
            name: match.name || photographer.name,
            avatar: match.avatar || match.profile_image || match.photo || photographer.avatar,
            address: match.address || photographer.address,
            city: match.city || photographer.city,
            state: match.state || photographer.state,
            zip: match.zip || photographer.zip,
            distance: Number.isFinite(parsedDistance) ? parsedDistance : photographer.distance,
            distanceFrom: match.distance_from ?? match.distanceFrom ?? photographer.distanceFrom,
            previousShootId: match.previous_shoot_id ?? match.previousShootId ?? photographer.previousShootId,
            availabilitySlots: nextAvailableSlots,
            netAvailableSlots: nextNetSlots,
            bookedSlots: match.booked_slots ?? photographer.bookedSlots,
            unavailableSlots: match.unavailable_slots ?? photographer.unavailableSlots,
            hasAvailability: rawAvailableSlots.length > 0 || match.has_availability || photographer.hasAvailability,
            shootsCountToday: match.shoots_count_today ?? photographer.shootsCountToday,
          };
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching photographer availability:', error);
      } finally {
        if (!cancelled) setIsLoadingAvailability(false);
      }
    };

    fetchAvailability();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    assignPhotographerOpen,
    isAdminOrRep,
    photographerAvailabilityKey,
    scheduleDate,
    scheduleTime,
    setIsLoadingAvailability,
    setPhotographers,
    shootLocationKey,
  ]);
}
