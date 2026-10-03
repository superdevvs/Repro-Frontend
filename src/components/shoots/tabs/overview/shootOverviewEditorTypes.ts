import type { TravelAvailabilityMetadata } from '@/features/travel/availabilityMetadata';
import type { ServiceDurationSource } from '@/utils/shootDuration';
import type { BookingAvailabilitySlot } from '@/types/availability';

export type PresenceOption = 'self' | 'other' | 'lockbox';

export type ServiceOption = ServiceDurationSource & {
  duration_minutes?: number | null;
  shoot_duration_minutes?: number | null;
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
  duration_minutes?: number;
};

export type PhotographerPickerContext = {
  source: 'edit';
  categoryKey?: string;
  categoryName?: string;
  complimentarySourceServiceId?: string;
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

export type PhotographerPickerOption = TravelAvailabilityMetadata & {
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
  bookedSlots?: BookingAvailabilitySlot[];
  unavailableSlots?: Array<{ start_time: string; end_time: string; status?: string }>;
  hasAvailability?: boolean;
  shootsCountToday?: number;
  miles_to_job?: number | null;
  map?: Record<string, unknown> | null;
  job?: Record<string, unknown> | null;
};

export type ClientOption = {
  id: string;
  name: string;
  email: string;
  company?: string;
};

