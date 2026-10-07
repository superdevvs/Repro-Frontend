export type TravelTransition = {
  id: string;
  direction: 'incoming' | 'outgoing' | 'between_proposed';
  source: 'fixed' | 'same_building' | 'google_routes' | 'mileage_band' | 'unknown';
  required_minutes: number | null;
  available_minutes: number;
  shortfall_minutes: number | null;
  reason_code: string;
  drive_minutes?: number;
  distance_miles?: number;
  attribution?: string;
  earliest_start?: string | null;
  latest_start?: string | null;
  candidate_start?: string;
  candidate_end?: string;
  neighbor?: { shoot_id: number; scheduled_at: string; end_at: string; timezone: string; services: Array<{ id: number; name: string }>; photographer?: { id: number; name: string }; can_view_details: true };
};
export type TravelAlternative = {
  scheduled_at: string;
  photographer_id: number | string;
  offset_minutes?: number;
  shifted_visits?: Array<{ photographer_id: number | string; scheduled_at: string; duration_minutes: number }>;
};
export type TravelFeasibility = {
  visits?: Array<{ photographer_id: number; start: string; end: string; scheduled_at: string; duration_minutes: number; timezone: string; is_target?: boolean }>;
  enabled: boolean;
  status: 'available' | 'conflict' | 'review_required';
  available: boolean;
  reason_codes: string[];
  transitions: TravelTransition[];
  alternatives: TravelAlternative[];
  can_override: boolean;
  can_confirm_location?: boolean;
  policy_version: string;
  schedule_version: string;
  confirmation_version?: string;
  budget?: { used_elements: number; limit_elements: number; remaining_elements: number; usage_percent: number; alert_level: 0 | 75 | 90 | 100; budget_usd: number };
};
export type TravelPayload = Record<string, unknown>;
export type ScheduleAdjustment = { shoot_id: number; photographer_id: number; from_start: string; scheduled_at: string; expected_edit_version: string };
export type TravelConfirmation = { travel_override?: boolean; travel_override_reason?: string; travel_override_confirmed?: boolean; travel_override_confirmation_version?: string; travel_location_confirmed?: boolean; schedule_adjustments?: ScheduleAdjustment[]; notify_client?: boolean; notify_photographer?: boolean };

export function readTravelFeasibility(value: unknown): TravelFeasibility | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const candidate = (record.feasibility ?? record.data ?? record) as Partial<TravelFeasibility> | null;
  return candidate && typeof candidate.enabled === 'boolean' && ['available', 'conflict', 'review_required'].includes(String(candidate.status))
    ? candidate as TravelFeasibility : null;
}
