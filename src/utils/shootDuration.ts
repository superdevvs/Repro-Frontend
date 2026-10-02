export const DEFAULT_SHOOT_DURATION_MINUTES = 60;
export const MIN_SHOOT_DURATION_MINUTES = 5;
export const MAX_SHOOT_DURATION_MINUTES = 300;
export const BOOKING_TRAVEL_BUFFER_MINUTES = 15;

export type ServiceDurationSource = {
  duration_minutes?: number | null; shoot_duration_minutes?: number | null;
  photographer_required?: boolean | null;
  pricing_type?: string; sqft_ranges?: Array<{ sqft_from: number; sqft_to: number; duration?: number | null }>;
  booking_duration_default_minutes?: number | null;
  booking_duration_min_minutes?: number | null;
  booking_duration_max_minutes?: number | null;
  booking_duration_defaults?: { default_minutes: number; min_minutes: number; max_minutes: number };
  /** Current catalogue timing for new drafts, independent of cached tier prices. */
  booking_duration_tiers?: Array<{ sqft_from: number; sqft_to: number; duration?: number | null }>;
};

export function serviceDurationLimits(service: ServiceDurationSource) {
  return {
    minMinutes: service.booking_duration_defaults?.min_minutes ?? service.booking_duration_min_minutes ?? MIN_SHOOT_DURATION_MINUTES,
    maxMinutes: service.booking_duration_defaults?.max_minutes ?? service.booking_duration_max_minutes ?? MAX_SHOOT_DURATION_MINUTES,
  };
}

/** Resolve without rewriting a positive booked snapshot; inputs validate new edits. */
export function resolveShootDuration(...values: unknown[]): number {
  const minutes = values.map(Number).find(value => Number.isFinite(value) && value > 0)
    ?? DEFAULT_SHOOT_DURATION_MINUTES;
  return Math.round(minutes);
}

export function resolveServiceShootDuration(service: ServiceDurationSource, sqft?: number | null, override?: number | null): number {
  if (Number(override) > 0 || Number(service.duration_minutes) > 0) return resolveShootDuration(override, service.duration_minutes);
  if (service.photographer_required === false) return 0;
  const durationTiers = service.booking_duration_tiers ?? (service.pricing_type === 'variable' ? service.sqft_ranges : undefined);
  const tier = sqft ? durationTiers?.find(range => sqft >= range.sqft_from && sqft <= range.sqft_to) : undefined;
  return resolveShootDuration(override, service.duration_minutes, tier?.duration, service.shoot_duration_minutes,
    service.booking_duration_defaults?.default_minutes, service.booking_duration_default_minutes);
}

/** A package is already one catalog row; count each selected on-site SKU once. */
export function sumServiceShootDurations(services: Array<ServiceDurationSource & { id: string | number }>, sqft?: number | null,
  overrides: Record<string, { duration_minutes?: number }> = {}): number {
  const unique = new Map(services.map(service => [String(service.id), service]));
  return [...unique.values()].filter(service => service.photographer_required !== false)
    .reduce((total, service) => total + resolveServiceShootDuration(service, sqft, overrides[String(service.id)]?.duration_minutes), 0);
}
