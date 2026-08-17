import axios from 'axios';
import API_ROUTES from '@/lib/api';
import type { AddressDetails } from '@/utils/addressLookup';
import type { PricingDiscountType } from '@/utils/pricing';
import { formatDateForWallClockInput, formatTimeForWallClockInput } from '@/utils/wallClockDateTime';

export interface SqftRange {
  id?: number;
  sqft_from: number;
  sqft_to: number;
  price: number;
  photographer_pay?: number | null;
}

export interface Service {
  id: number | string;
  name: string;
  price?: number;
  pricing_type?: 'fixed' | 'variable';
  sqft_ranges?: SqftRange[];
  category?: { id: number | string; name: string } | string;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
}

export interface Photographer {
  id: string | number;
  name: string;
  avatar?: string;
  email?: string;
  city?: string;
  state?: string;
  address?: string;
  zip?: string;
  distance?: number;
  distanceFrom?: 'home' | 'previous_shoot';
  previousShootId?: number;
  travel_range?: number | null;
  travel_range_unit?: string;
  availabilitySlots?: AvailabilitySlot[];
  netAvailableSlots?: AvailabilitySlot[];
  unavailableSlots?: AvailabilitySlot[];
  bookedSlots?: Array<AvailabilitySlot & { status?: string; shoot_id?: number }>;
  shootsCountToday?: number;
}

export type AvailabilitySlot = {
  start_time: string;
  end_time: string;
};

export type PhotographerAvailabilityMap = Record<string, AvailabilitySlot[]>;

export interface PropertyDetails {
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  squareFeet?: number;
  square_feet?: number;
  livingArea?: number;
  living_area?: number;
  yearBuilt?: number;
  lotSize?: number;
  mls_id?: string;
  mlsId?: string;
  mlsNumber?: string;
  price?: number;
  listPrice?: number;
  lot_size?: number;
  year_built?: number;
  property_type?: string;
  propertyType?: string;
  zpid?: string;
  source?: string;
  confidence?: number;
  field_sources?: Record<string, string>;
  property_source_chain?: string[];
  [key: string]: unknown;
}

export type PhotographerSource = {
  id?: string | number;
  name?: string;
  avatar?: string;
  profile_image?: string;
  profile_photo_url?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipcode?: string;
  travel_range?: number | null;
  travel_range_unit?: string;
  metadata?: {
    address?: string;
    homeAddress?: string;
    city?: string;
    state?: string;
    zip?: string;
    zipcode?: string;
    travel_range?: number | null;
    travel_range_unit?: string;
  };
};

export type PropertyLookupInput = {
  property_details?: Record<string, unknown> | null;
  sqft?: number | string;
  squareFeet?: number | string;
  square_feet?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  lot_size?: number | string;
  year_built?: number | string;
  mls_id?: string;
  price?: number | string;
  property_type?: string;
  zpid?: string;
  source?: string;
  confidence?: number;
  field_sources?: Record<string, string>;
  property_source_chain?: string[];
  [key: string]: unknown;
};

export type SelectedServiceSource =
  | string
  | {
      id?: string | number;
      service_id?: string | number;
      name?: string;
      label?: string;
    };

export type ServiceApiRange = {
  id?: number;
  sqft_from?: number | string;
  sqft_to?: number | string;
  price?: number | string;
  photographer_pay?: number | string | null;
};

export type ServiceApiRecord = {
  id?: string | number;
  name?: string;
  price?: number | string;
  pricing_type?: 'fixed' | 'variable' | string;
  category?: { id?: string | number; name?: string };
  sqft_ranges?: ServiceApiRange[];
  sqftRanges?: ServiceApiRange[];
};

export interface ShootDetails {
  id: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  client?: {
    id: number;
    name: string;
    email?: string;
    email_verified?: boolean;
    emailVerified?: boolean;
    phonenumber?: string;
    phone?: string;
    client_discount_type?: PricingDiscountType;
    client_discount_value?: number | string | null;
    clientDiscountType?: PricingDiscountType;
    clientDiscountValue?: number | string | null;
  };
  services?: Service[];
  serviceObjects?: Service[];
  serviceItems?: Array<Record<string, unknown>>;
  service_items?: Array<Record<string, unknown>>;
  scheduledAt?: string;
  scheduled_at?: string;
  totalQuote?: number;
  invoice_adjustments_total?: number | string | null;
  invoiceAdjustmentsTotal?: number | string | null;
  shoot_notes?: string;
  shootNotes?: string;
  location?: { address?: string; city?: string; state?: string; zip?: string };
  payment?: {
    totalQuote?: number;
    taxRate?: number | string | null;
    invoice_adjustments_total?: number | string | null;
    invoiceAdjustmentsTotal?: number | string | null;
    discount_type?: PricingDiscountType;
    discount_value?: number | string | null;
    discount_amount?: number | string | null;
    discountType?: PricingDiscountType;
    discountValue?: number | string | null;
    discountAmount?: number | string | null;
  };
  photographer_id?: number | string;
  photographer?: { id: number; name: string; email?: string };
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_details?: PropertyDetails;
  tax_percent?: number | string | null;
  taxPercent?: number | string | null;
  discount_type?: PricingDiscountType;
  discount_value?: number | string | null;
  discount_amount?: number | string | null;
  discountType?: PricingDiscountType;
  discountValue?: number | string | null;
  discountAmount?: number | string | null;
}

export interface ShootEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  shootId: string | number;
  onSaved?: () => void;
}

export type PhotographerPickerContext = {
  categoryKey?: string;
  categoryName?: string;
} | null;

export type MobileEditPanel = 'details' | 'schedule' | 'services';

export type ServiceScheduleFields = {
  date: string;
  time: string;
};

export const normalizeCategoryKey = (value?: string) =>
  (value || 'other').trim().toLowerCase().replace(/s$/, '') || 'other';

export const formatDateForInputValue = (value?: unknown): string => {
  return formatDateForWallClockInput(value);
};

export const formatTimeForInputValue = (value?: unknown): string => {
  return formatTimeForWallClockInput(value);
};

export const mapPhotographerOption = (photographer: PhotographerSource): Photographer => ({
  id: photographer.id?.toString() || '',
  name: photographer.name || 'Unknown',
  avatar: photographer.avatar || photographer.profile_image || photographer.profile_photo_url,
  email: photographer.email || '',
  address: photographer.address || photographer.metadata?.address || photographer.metadata?.homeAddress,
  city: photographer.city || photographer.metadata?.city,
  state: photographer.state || photographer.metadata?.state,
  zip: photographer.zip || photographer.zipcode || photographer.metadata?.zip || photographer.metadata?.zipcode,
  travel_range: photographer.travel_range ?? photographer.metadata?.travel_range ?? null,
  travel_range_unit: photographer.travel_range_unit ?? photographer.metadata?.travel_range_unit ?? 'miles',
});

export const normalizeSlotTime = (value?: string) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '00:00';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

export const timeToMinutes = (value: string) => {
  const [hours, minutes] = normalizeSlotTime(value).split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export const availabilityScaleStartMinutes = 8 * 60;
export const availabilityScaleTotalMinutes = 12 * 60;
export const availabilityScaleTickCount = 9;

export const loadPhotographerOptions = async (): Promise<Photographer[]> => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await axios.get(API_ROUTES.people.adminPhotographers, { headers });
    const data = response.data?.data || response.data || [];
    const formatted = Array.isArray(data) ? data.map(mapPhotographerOption) : [];
    if (formatted.length > 0) {
      return formatted;
    }
  } catch (error) {
    console.warn('[ShootEditModal] Admin photographers endpoint failed, falling back to public list:', error);
  }

  try {
    const response = await axios.get(API_ROUTES.people.photographers);
    const data = response.data?.data || response.data || [];
    return Array.isArray(data) ? data.map(mapPhotographerOption) : [];
  } catch (error) {
    console.error('[ShootEditModal] Public photographers endpoint failed:', error);
    return [];
  }
};

export const extractLookupPropertyDetails = (details: PropertyLookupInput | AddressDetails | null | undefined): PropertyDetails => {
  const toOptionalNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const lookupDetails =
    details?.property_details && typeof details.property_details === 'object'
      ? (details.property_details as PropertyDetails)
      : {};
  const lookupInput = details as PropertyLookupInput | null | undefined;

  const sqft =
    details?.sqft ??
    lookupInput?.squareFeet ??
    lookupInput?.square_feet ??
    lookupDetails.sqft ??
    lookupDetails.squareFeet ??
    lookupDetails.square_feet ??
    lookupDetails.livingArea ??
    lookupDetails.living_area;
  const bedrooms = details?.bedrooms ?? lookupDetails.bedrooms ?? lookupDetails.beds;
  const bathrooms = details?.bathrooms ?? lookupDetails.bathrooms ?? lookupDetails.baths;
  const lotSize = details?.lot_size ?? lookupDetails.lot_size ?? lookupDetails.lotSize;
  const yearBuilt = details?.year_built ?? lookupDetails.year_built ?? lookupDetails.yearBuilt;

  return {
    ...lookupDetails,
    bedrooms: toOptionalNumber(bedrooms) ?? lookupDetails.bedrooms ?? undefined,
    beds: toOptionalNumber(bedrooms) ?? lookupDetails.beds ?? undefined,
    bathrooms: toOptionalNumber(bathrooms) ?? lookupDetails.bathrooms ?? undefined,
    baths: toOptionalNumber(bathrooms) ?? lookupDetails.baths ?? undefined,
    sqft: toOptionalNumber(sqft),
    squareFeet: toOptionalNumber(sqft) ?? lookupDetails.squareFeet ?? undefined,
    mls_id:
      details?.mls_id ??
      lookupDetails.mls_id ??
      lookupDetails.mlsId ??
      lookupDetails.mlsNumber ??
      undefined,
    price: toOptionalNumber(details?.price) ?? lookupDetails.price ?? lookupDetails.listPrice ?? undefined,
    lot_size: toOptionalNumber(lotSize),
    lotSize: toOptionalNumber(lotSize) ?? lookupDetails.lotSize ?? undefined,
    year_built: toOptionalNumber(yearBuilt),
    yearBuilt: toOptionalNumber(yearBuilt) ?? lookupDetails.yearBuilt ?? undefined,
    property_type:
      details?.property_type ??
      lookupDetails.property_type ??
      lookupDetails.propertyType ??
      undefined,
    zpid: details?.zpid ?? lookupDetails.zpid ?? undefined,
    source: details?.source ?? lookupDetails.source ?? undefined,
    confidence: details?.confidence ?? lookupDetails.confidence ?? undefined,
    field_sources: details?.field_sources ?? lookupDetails.field_sources ?? undefined,
    property_source_chain:
      details?.property_source_chain ?? lookupDetails.property_source_chain ?? undefined,
  };
};

export const resolveSelectedServiceIds = (serviceSource: SelectedServiceSource[], servicesCatalog: Service[]) => {
  const ids = new Set<string>();

  serviceSource.forEach((service) => {
    const rawId = service && typeof service === 'object'
      ? service.id || service.service_id
      : undefined;
    const normalizedId = rawId != null ? String(rawId) : '';
    if (normalizedId && servicesCatalog.some((catalogService) => String(catalogService.id) === normalizedId)) {
      ids.add(normalizedId);
      return;
    }

    const rawName = typeof service === 'string'
      ? service
      : service?.name || service?.label;
    const normalizedName = String(rawName || '').trim().toLowerCase();
    if (!normalizedName) return;

    const matchedService = servicesCatalog.find((catalogService) =>
      String(catalogService.name || '').trim().toLowerCase() === normalizedName,
    );
    if (matchedService?.id != null) {
      ids.add(String(matchedService.id));
    }
  });

  return ids;
};
