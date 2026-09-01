import type { ShootData } from '@/types/shoots';

// The API also returns snake_case and alternate aliases for property and
// schedule fields that `ShootData` does not declare.
export type ShootWithLegacyOverviewFields = ShootData & {
  property_details?: Record<string, unknown> | null;
  beds?: unknown;
  bedrooms?: unknown;
  baths?: unknown;
  bathrooms?: unknown;
  sqft?: unknown;
  squareFeet?: unknown;
  square_feet?: unknown;
  livingArea?: unknown;
  living_area?: unknown;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
  serviceItems?: unknown[];
  service_items?: unknown[];
};

// Service items arrive under several payload shapes with both snake_case and
// camelCase keys.
export type LegacyServiceItemRecord = {
  id?: string | number | null;
  service_id?: string | number | null;
  serviceId?: string | number | null;
  name?: string | null;
  service_name?: string | null;
  serviceName?: string | null;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
  [key: string]: unknown;
};

export type OverviewServiceItemPayload = {
  service_id: number;
  price?: number;
  quantity?: number;
  scheduled_at: string | null;
  photographer_pay?: number;
};

export type ComplimentaryServiceItemPayload = {
  source_shoot_service_id: number;
  service_id: number;
  photographer_id: number;
  scheduled_at: string;
};

export type ComplimentaryServiceOptionsPayload = {
  idempotency_key: string;
  reason_code: string;
  reason_note?: string;
  pay_photographer: boolean;
  pay_sales_rep: boolean;
  service_items: ComplimentaryServiceItemPayload[];
};

type OverviewServicePayload = Omit<OverviewServiceItemPayload, 'service_id'> & {
  id: number;
};

// The save endpoint accepts service and photographer request shapes that are
// distinct from the display-oriented fields on `ShootData`.
export type ShootOverviewUpdatePayload = Omit<Partial<ShootData>, 'service_items' | 'services'> & {
  service_items?: OverviewServiceItemPayload[];
  services?: OverviewServicePayload[];
  service_photographers?: Array<{ service_id: number; photographer_id: number }>;
  complimentary_service_options?: ComplimentaryServiceOptionsPayload;
};
