import { useEffect, useMemo, useState } from 'react';
import API_ROUTES from '@/lib/api';
import { fetchDurationAwareAvailability, type PhotographerDurationGroup } from '@/utils/photographerVisitDuration';
import { travelAvailabilityMetadata } from '@/features/travel/availabilityMetadata';
import { getCoordinatesFromAddress } from '@/utils/distanceUtils';

export type PickerCheckStatus = 'idle' | 'loading' | 'ready' | 'error';
type Slot = { start_time: string; end_time: string; status?: string };
export type PickerAvailabilityRow = {
  id: string | number; name?: string; avatar?: string; profile_image?: string;
  distance?: number; miles_to_job?: number | null; distance_from?: 'home' | 'previous_shoot'; previous_shoot_id?: number;
  availability_slots?: Slot[]; net_available_slots?: Slot[]; unavailable_slots?: Slot[];
  booked_slots?: Array<Slot & { shoot_id?: number }>; shoots_count_today?: number;
  map?: Record<string, unknown> | null; job?: Record<string, unknown> | null;
};
type Location = { address: string; city: string; state: string; zip: string; latitude?: number; longitude?: number };
type Options = { active: boolean; scope: string; date: string; time: string; location: Location; photographerIds: Array<string | number>; groups: PhotographerDurationGroup[] };
type Check = { key: string; status: PickerCheckStatus; rows: PickerAvailabilityRow[]; error?: string };

/** Directory browsing stays independent of this optional day preview. Saves use the itinerary feasibility check. */
export function usePhotographerPickerAvailability({ active, scope, date, time, location, photographerIds, groups }: Options) {
  const [attempt, setAttempt] = useState(0);
  const key = active && date && photographerIds.length ? JSON.stringify({ scope, date, time, location, photographerIds, groups, attempt }) : '';
  const [check, setCheck] = useState<Check>({ key: '', status: 'idle', rows: [] });
  useEffect(() => {
    if (!key) return;
    const input = JSON.parse(key) as Omit<Options, 'active'>;
    const controller = new AbortController();
    let current = true;
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (current) setCheck({ key, status: 'error', rows: [], error: 'Availability check timed out. Retry before confirming the appointment.' });
    }, 25000);
    setCheck({ key, status: 'loading', rows: [] });
    void (async () => {
      try {
        let { latitude, longitude } = input.location;
        if ((latitude === undefined || longitude === undefined) && input.location.address && input.location.city && input.location.state) {
          try {
            const coords = await getCoordinatesFromAddress(input.location.address, input.location.city, input.location.state, input.location.zip);
            latitude = coords?.lat; longitude = coords?.lon;
          } catch { /* Coordinates are optional; server validation remains authoritative. */ }
        }
        if (!current || controller.signal.aborted) return;
        const response = await fetchDurationAwareAvailability(API_ROUTES.photographerAvailability.forBooking, {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ date: input.date, time: input.time, shoot_address: input.location.address, shoot_city: input.location.city,
            shoot_state: input.location.state, shoot_zip: input.location.zip, shoot_latitude: latitude, shoot_longitude: longitude,
            photographer_ids: input.photographerIds.map(Number) }),
        }, input.groups);
        if (!response.ok) throw new Error(response.status === 403 ? 'You do not have permission to view this availability.' : 'Unable to check availability. Please retry.');
        const json = await response.json() as { data?: PickerAvailabilityRow[]; job?: Record<string, unknown> | null };
        if (!Array.isArray(json.data)) throw new Error('Unable to check availability. Please retry.');
        if (current && !controller.signal.aborted) setCheck({ key, status: 'ready', rows: json.data.map(row => ({ ...row, job: row.job ?? json.job })) });
      } catch (error) {
        if (current && !controller.signal.aborted) setCheck({ key, status: 'error', rows: [], error: error instanceof Error ? error.message : 'Unable to check availability. Please retry.' });
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { current = false; controller.abort(); window.clearTimeout(timeout); };
  }, [key]);
  const status: PickerCheckStatus = !key ? 'idle' : check.key === key ? check.status : 'loading';
  const rows = useMemo(() => check.key === key && status === 'ready' ? check.rows : [], [check, key, status]);
  const byId = useMemo(() => new Map(rows.map(row => [String(row.id), row])), [rows]);
  return { status, byId, error: status === 'error' ? check.error : undefined, retry: () => setAttempt(value => value + 1) };
}

export function enrichPickerPhotographer<T extends { id: string | number; name: string }>(person: T, row?: PickerAvailabilityRow) {
  const net = row?.net_available_slots ?? [];
  return { ...person, id: String(person.id), ...travelAvailabilityMetadata(row ?? {}),
    distance: row?.miles_to_job ?? row?.distance, miles_to_job: row?.miles_to_job ?? row?.distance ?? null,
    distanceFrom: row?.distance_from, previousShootId: row?.previous_shoot_id, shootsCountToday: row?.shoots_count_today,
    map: row?.map ?? null, job: row?.job ?? null, availabilitySlots: row?.availability_slots ?? [], netAvailableSlots: net,
    bookedSlots: row?.booked_slots ?? [], unavailableSlots: row?.unavailable_slots ?? [], hasAvailability: net.length > 0,
  };
}

export function pickerAvailabilityLabel(status: PickerCheckStatus, row?: PickerAvailabilityRow) {
  if (status === 'loading') return 'Checking availability…';
  if (status === 'error') return 'Availability check failed';
  if (status !== 'ready' || !row || !Array.isArray(row.net_available_slots)) return 'Availability not checked';
  return row.net_available_slots?.length ? 'Available times shown' : 'No available times for this visit';
}
