export const DEFAULT_SHOOT_DURATION_MINUTES = 60;
export const MIN_SHOOT_DURATION_MINUTES = 30;
export const MAX_SHOOT_DURATION_MINUTES = 240;

/** Keep an existing 30-minute appointment when resolving an edited duration. */
export function resolveShootDuration(...values: unknown[]): number {
  const minutes = values.map(Number).find(value => Number.isFinite(value) && value > 0)
    ?? DEFAULT_SHOOT_DURATION_MINUTES;
  return Math.max(MIN_SHOOT_DURATION_MINUTES, Math.min(MAX_SHOOT_DURATION_MINUTES, Math.round(minutes)));
}

export function resolveServiceShootDuration(service: {
  duration_minutes?: number | null; shoot_duration_minutes?: number | null;
  pricing_type?: string; sqft_ranges?: Array<{ sqft_from: number; sqft_to: number; duration?: number | null }>;
}, sqft?: number | null, override?: number | null): number {
  const tier = service.pricing_type === 'variable' && sqft
    ? service.sqft_ranges?.find(range => sqft >= range.sqft_from && sqft <= range.sqft_to) : undefined;
  return resolveShootDuration(override, service.duration_minutes, service.shoot_duration_minutes, tier?.duration);
}
