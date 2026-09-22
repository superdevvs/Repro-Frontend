import axios, { type AxiosRequestConfig } from 'axios';
import API_ROUTES from '@/lib/api';

type NewBookingPayload = {
  address: string; city: string; state: string; zip: string;
  scheduled_date: string; time: string;
  services: Array<{ id?: unknown; photographer_id?: unknown; scheduled_at?: unknown }>;
};

/** Recheck service/radius eligibility immediately before a new booking is sent. */
export async function submitNewShootWithEligibility(
  url: string, payload: NewBookingPayload, config: AxiosRequestConfig,
) {
  const groups = new Map<string, { photographerId: number; serviceIds: number[]; date: string; time: string }>();
  for (const service of payload.services) {
    if (!service.photographer_id) continue; // Products without on-site work need no assignment.
    const photographerId = Number(service.photographer_id);
    const serviceId = Number(service.id);
    const timestamp = typeof service.scheduled_at === 'string' ? service.scheduled_at : '';
    const date = timestamp ? timestamp.slice(0, 10) : payload.scheduled_date;
    const time = timestamp ? timestamp.slice(11, 16) : payload.time;
    if (!Number.isInteger(photographerId) || photographerId <= 0 || !Number.isInteger(serviceId) || serviceId <= 0) {
      throw new Error('Please return to Scheduling and select a photographer for each on-site service.');
    }
    const key = `${photographerId}|${date}|${time}`;
    const group = groups.get(key) || { photographerId, serviceIds: [], date, time };
    group.serviceIds.push(serviceId);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    let eligible: boolean;
    try {
      const response = await axios.post<{ data?: Array<{ id: string | number }> }>(API_ROUTES.photographerAvailability.forBooking, {
        date: group.date, time: group.time,
        shoot_address: payload.address, shoot_city: payload.city, shoot_state: payload.state, shoot_zip: payload.zip,
        photographer_ids: [group.photographerId], service_ids: group.serviceIds, require_all_services: true,
      }, { ...config, timeout: 15000 });
      if (!Array.isArray(response.data?.data)) throw new Error('Invalid eligibility response');
      eligible = response.data.data.some(person => String(person.id) === String(group.photographerId));
    } catch {
      throw new Error('Could not verify photographer eligibility. Please try confirming the booking again.');
    }
    if (!eligible) {
      throw new Error('A selected photographer is no longer eligible for this booking. Return to Scheduling and choose another photographer.');
    }
    // Availability is deliberately not a new constraint: clients may request a
    // time for staff approval, and existing staff scheduling rules still apply.
  }
  return axios.post(url, payload, config);
}
