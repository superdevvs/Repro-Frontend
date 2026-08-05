import type React from 'react';

export interface SchedulingPhotographer {
  id: string;
  name: string;
  avatar?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  metadata?: {
    specialties?: Array<string | number>;
    travel_range?: number;
    travel_range_unit?: string;
  };
  specialties?: Array<string | number>;
  travel_range?: number;
  travel_range_unit?: string;
}

export interface SchedulingSlot {
  date?: string | null;
  day_of_week?: string | null;
  start_time: string;
  end_time: string;
  status?: string;
  shoot_id?: number;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface SchedulingPhotographerView extends SchedulingPhotographer {
  distance?: number;
  distanceFrom?: 'home' | 'previous_shoot';
  previousShootId?: number;
  availabilitySlots?: SchedulingSlot[];
  unavailableSlots?: SchedulingSlot[];
  bookedSlots?: SchedulingSlot[];
  netAvailableSlots?: SchedulingSlot[];
  isAvailableAtTime?: boolean;
  hasAvailability?: boolean;
  shootsCountToday?: number;
}

export type AvailabilityByPhotographer = Record<string, SchedulingSlot[]>;

export type BookingPhotographerPayload = Omit<SchedulingPhotographerView, 'id' | 'name' | 'distance'> & {
  id: string | number;
  name?: string;
  distance?: number | string;
  profile_image?: string;
  photo?: string;
  availability_slots?: SchedulingSlot[];
  unavailable_slots?: SchedulingSlot[];
  booked_slots?: SchedulingSlot[];
  net_available_slots?: SchedulingSlot[];
  is_available_at_time?: boolean;
  has_availability?: boolean;
  shoots_count_today?: number;
  distance_from?: 'home' | 'previous_shoot';
  previous_shoot_id?: number;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

export const readAvailabilityMap = (payload: unknown): AvailabilityByPhotographer => {
  if (!isRecord(payload) || !isRecord(payload.data)) return {};

  return Object.fromEntries(
    Object.entries(payload.data).map(([id, slots]) => [
      id,
      Array.isArray(slots) ? slots as SchedulingSlot[] : [],
    ]),
  );
};

export const readBookingPhotographers = (payload: unknown): BookingPhotographerPayload[] => {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.filter((value): value is BookingPhotographerPayload =>
    isRecord(value)
      && (typeof value.id === 'string' || typeof value.id === 'number'),
  );
};

export const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

export interface SchedulingFormProps {
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  time: string;
  setTime: React.Dispatch<React.SetStateAction<string>>;
  formErrors: Record<string, string>;
  setFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSubmit: () => void;
  goBack: () => void;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  bedrooms?: number | '';
  bathrooms?: number | '';
  sqft?: number | '';
  setAddress?: React.Dispatch<React.SetStateAction<string>>;
  setCity?: React.Dispatch<React.SetStateAction<string>>;
  setState?: React.Dispatch<React.SetStateAction<string>>;
  setZip?: React.Dispatch<React.SetStateAction<string>>;
  photographer?: string;
  photographers?: SchedulingPhotographer[];
  setPhotographer?: React.Dispatch<React.SetStateAction<string>>;
  servicePhotographers?: Record<string, string>;
  setServicePhotographers?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  serviceSchedules?: Record<string, { date?: string; time?: string }>;
  setServiceSchedules?: React.Dispatch<React.SetStateAction<Record<string, { date?: string; time?: string }>>>;
  selectedServices?: Array<{ id: string; name: string; description?: string; price: number; category?: { id: string; name: string } }>;
  sameDayAddressWarningMessage?: string;
}

