import API_ROUTES from '@/lib/api';
import { getApiHeaders } from '@/services/api';

export type SchedulingPhotographer = { id: string; name: string; avatar?: string; email?: string };

/** The scheduling directory is available without administrative account-list privileges. */
export async function loadSchedulingPhotographers(signal?: AbortSignal): Promise<SchedulingPhotographer[]> {
  const response = await fetch(API_ROUTES.people.photographers, { signal, headers: getApiHeaders() });
  if (!response.ok) throw new Error('Unable to load photographers. Please retry.');
  const payload = await response.json();
  if (!Array.isArray(payload.data)) throw new Error('Unable to load photographers. Please retry.');
  return payload.data.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Unable to load photographers. Please retry.');
    const person = value as Record<string, unknown>;
    if (!['string', 'number'].includes(typeof person.id) || !Number.isInteger(Number(person.id)) || Number(person.id) <= 0 || typeof person.name !== 'string' || !person.name.trim()) {
      throw new Error('Unable to load photographers. Please retry.');
    }
    return { id: String(person.id), name: person.name, avatar: typeof person.avatar === 'string' ? person.avatar : undefined, email: typeof person.email === 'string' ? person.email : undefined };
  });
}
