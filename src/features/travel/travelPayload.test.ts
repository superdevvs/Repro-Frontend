import { describe, expect, it } from 'vitest';
import { shootTravelPayload } from './travelPayload';
import { travelAvailabilityMetadata } from './availabilityMetadata';
describe('travel request and availability metadata', () => {
  it('uses edited location and assignment over persisted aliases, with explicit timezone', () => {
    expect(shootTravelPayload({ id: 4, client_id: 2, photographer_id: 9, address: 'Old', timezone: 'America/New_York' }, {
      location: { address: 'New', city: 'Baltimore', state: 'MD', zip: '21201' }, client: { id: 3 }, photographer: { id: 10 }, scheduledDate: '2026-10-05', time: '09:00',
    })).toMatchObject({ shoot_id: 4, client_id: 3, photographer_id: 10, address: 'New', city: 'Baltimore', scheduled_at: '2026-10-05T13:00:00.000Z', action_mode: 'update' });
  });
  it('leaves rescheduling relative unit shifts to the server and retains changed line duration only', () => {
    const input = { requested_date: '2026-10-05', requested_time: '09:00', service_lines: [{ shoot_service_id: 8, duration_minutes: 15 }] };
    expect(shootTravelPayload({ id: 4 }, input, 'reschedule')).toMatchObject({ shoot_id: 4, action_mode: 'reschedule', ...input });
  });
  it('preserves public candidate metadata without copying private provider fields', () => {
    expect(travelAvailabilityMetadata({ hybrid_travel_enabled: true, travel_check_required: true, travel_status: 'review_required', provider_key: 'private' })).toMatchObject({ hybridTravelEnabled: true, travelCheckRequired: true, travelStatus: 'review_required' });
    expect(travelAvailabilityMetadata({ provider_key: 'private' })).not.toHaveProperty('provider_key');
  });
});
