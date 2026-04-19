import type React from "react";

export type Photographer = { id: string; name: string; avatar?: string };

export type AvailabilityStatus = "available" | "booked" | "unavailable";

export interface ShootDetails {
  id: number;
  title: string;
  address?: string;
  shoot_status: string;
  client?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
  };
  services?: Array<{
    id: number;
    name: string;
    price: number;
  }>;
  notes?: string;
  duration_minutes?: number;
}

export interface Availability {
  id: string;
  photographerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AvailabilityStatus;
  shootTitle?: string;
  origin?: 'specific' | 'weekly';
  isRandom?: boolean;
  shoot_id?: number;
  shootDetails?: ShootDetails;
}

export interface WeeklyScheduleItem {
  day: string;
  active: boolean;
  startTime: string;
  endTime: string;
}

export type GoogleCalendarAvailabilityStatus = {
  user_id?: number;
  user_name?: string;
  available: boolean;
  connected: boolean;
  provider_email?: string | null;
  calendar_id?: string | null;
  sync_enabled: boolean;
  last_synced_at?: string | null;
  last_error?: string | null;
};

export type AvailabilityToastFn = (args: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
}) => void;

export type BackendSlot = {
  id: number | string;
  photographer_id: number;
  date?: string | null;
  day_of_week?: string | null;
  start_time: string;
  end_time: string;
  status?: string;
  isRandom?: boolean;
  shoot_id?: number;
  shoot_details?: ShootDetails;
};
