import { resolveShootDuration } from '@/utils/shootDuration';

/** Missing legacy snapshots stay unset so catalogue/tier defaults can resolve later. */
export function getSavedServiceDuration(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const service = value as Record<string, unknown>;
  const pivot = service.pivot && typeof service.pivot === 'object' ? service.pivot as Record<string, unknown> : {};
  const duration = service.duration_minutes ?? pivot.duration_minutes;
  return Number(duration) > 0 ? resolveShootDuration(duration) : undefined;
}

export function withServiceDurationSnapshot<T extends { date: string; time: string }>(schedule: T, service: unknown): T & { duration_minutes?: number } {
  const duration = getSavedServiceDuration(service);
  return duration === undefined ? schedule : { ...schedule, duration_minutes: duration };
}
