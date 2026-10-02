import { normalizeSlotTime } from './suggestedTimeSlots';
import { sumServiceShootDurations, type ServiceDurationSource } from './shootDuration';

export type PhotographerVisitService = ServiceDurationSource & { id: string | number; assignedPhotographerId: string; moving: boolean };
export type PhotographerDurationGroup = { photographer_ids: number[]; duration_minutes: number };
/** Group equal-duration candidates so a move includes work already assigned at its destination. */
export function photographerVisitDurationGroups(services: PhotographerVisitService[], photographerIds: Array<string | number>, date: string, time: string,
  sqft: number | null, schedules: Record<string, { date?: string; time?: string; duration_minutes?: number }>): PhotographerDurationGroup[] {
  const groups = new Map<number, number[]>();
  for (const id of photographerIds) {
    const selected = services.filter(service => (service.moving || service.assignedPhotographerId === String(id))
      && (schedules[String(service.id)]?.date || date) === date
      && normalizeSlotTime(schedules[String(service.id)]?.time || time) === normalizeSlotTime(time));
    const duration = sumServiceShootDurations(selected, sqft, schedules) || 60;
    groups.set(duration, [...(groups.get(duration) ?? []), Number(id)]);
  }
  return [...groups].map(([duration_minutes, photographer_ids]) => ({ duration_minutes, photographer_ids }));
}

export async function fetchDurationAwareAvailability(url: string, options: RequestInit, groups: PhotographerDurationGroup[]): Promise<Response> {
  if (!groups.length) return fetch(url, options);
  const body = JSON.parse(String(options.body)) as Record<string, unknown>;
  const responses = await Promise.all(groups.map(group => fetch(url, { ...options, body: JSON.stringify({ ...body, ...group }) })));
  const failed = responses.find(response => !response.ok);
  if (failed) return failed;
  if (responses.length === 1) return responses[0];
  const payloads = await Promise.all(responses.map(response => response.json() as Promise<{ data?: unknown[]; [key: string]: unknown }>));
  return new Response(JSON.stringify({ ...payloads[0], data: payloads.flatMap(payload => payload.data ?? []) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
