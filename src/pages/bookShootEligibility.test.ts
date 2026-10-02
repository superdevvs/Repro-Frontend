import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import API_ROUTES from '@/lib/api';
import { submitNewShootWithEligibility } from './bookShootEligibility';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
const config = { headers: { Authorization: 'Bearer fixture-token' } };
const payload = {
  address: '123 Test Street', city: 'Rockville', state: 'MD', zip: '20850',
  scheduled_date: '2026-10-05', time: '10:00', is_client_request: true,
  services: [{ id: '1', photographer_id: '9', scheduled_at: '2026-10-05T10:00:00' }],
};
const url = '/api/shoots';
beforeEach(() => vi.clearAllMocks());

describe('final new-booking photographer eligibility', () => {
  it('checks repeated catalog services at each unit line schedule without requiring flat service arrays', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { data: [{ id: 9 }] } });
    const { services: _services, ...shared } = payload;
    const multi = { ...shared, service_lines: [{ service_id: '1', photographer_id: '9', scheduled_at: '2026-10-05T10:00:00' }, { service_id: '1', photographer_id: '9', scheduled_at: '2026-10-05T12:00:00' }] };
    await submitNewShootWithEligibility(url, multi, config);
    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(axios.post).toHaveBeenNthCalledWith(2, API_ROUTES.photographerAvailability.forBooking, expect.objectContaining({ service_ids: [1], time: '12:00' }), expect.anything());
    expect(axios.post).toHaveBeenLastCalledWith(url, multi, config);
  });
  it('sends actual per-visit duration15 and sums distinct simultaneous services without a buffer in their lengths', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { data: [{ id: 9 }] } });
    await submitNewShootWithEligibility(url, { ...payload, services: [{ ...payload.services[0], duration_minutes: 15 }] }, config);
    expect(axios.post).toHaveBeenNthCalledWith(1, API_ROUTES.photographerAvailability.forBooking, expect.objectContaining({ duration_minutes: 15 }), expect.anything());
    vi.clearAllMocks();
    await submitNewShootWithEligibility(url, { ...payload, services: [{ ...payload.services[0], duration_minutes: 15 }, { ...payload.services[0], id: '2', duration_minutes: 30 }] }, config);
    expect(axios.post).toHaveBeenNthCalledWith(1, API_ROUTES.photographerAvailability.forBooking, expect.objectContaining({ duration_minutes: 45 }), expect.anything());
  });
  it('does not create a booking when a previously selected photographer is now excluded', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { data: [] } });
    await expect(submitNewShootWithEligibility(url, payload, config)).rejects.toThrow(/no longer eligible/);
    expect(axios.post).toHaveBeenCalledOnce();
    expect(axios.post).toHaveBeenCalledWith(API_ROUTES.photographerAvailability.forBooking, expect.objectContaining({
      photographer_ids: [9], service_ids: [1], require_all_services: true,
    }), expect.objectContaining(config));
  });

  it('retains client Requested behavior when the photographer is eligible but unavailable', async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { data: [{ id: 9, is_available_at_time: false, has_availability: false }] } })
      .mockResolvedValueOnce({ data: { id: 100, status: 'requested' } });
    const result = await submitNewShootWithEligibility(url, payload, config);
    expect(result.data).toMatchObject({ status: 'requested' });
    expect(axios.post).toHaveBeenLastCalledWith(url, payload, config);
  });

  it('checks each service photographer at that service schedule before creating anything', async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { data: [{ id: 9 }] } })
      .mockResolvedValueOnce({ data: { data: [] } });
    await expect(submitNewShootWithEligibility(url, { ...payload, services: [
      ...payload.services, { id: '2', photographer_id: '10', scheduled_at: '2026-10-06T13:00:00' },
    ] }, config)).rejects.toThrow(/no longer eligible/);
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenNthCalledWith(2, API_ROUTES.photographerAvailability.forBooking, expect.objectContaining({
      photographer_ids: [10], service_ids: [2], date: '2026-10-06', time: '13:00',
    }), expect.objectContaining(config));
  });

  it('requires all assigned services from the same photographer while allowing separate specialists', async () => {
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { data: [{ id: 9 }] } })
      .mockResolvedValueOnce({ data: { id: 100 } });
    await submitNewShootWithEligibility(url, { ...payload, services: [
      ...payload.services, { id: '2', photographer_id: '9', scheduled_at: '2026-10-05T10:00:00' },
    ] }, config);
    expect(axios.post).toHaveBeenNthCalledWith(1, API_ROUTES.photographerAvailability.forBooking,
      expect.objectContaining({ service_ids: [1, 2], require_all_services: true }), expect.anything());
  });

  it('fails without creating a shoot when eligibility is unavailable and can retry', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Network unavailable'));
    await expect(submitNewShootWithEligibility(url, payload, config)).rejects.toThrow(/try confirming.*again/);
    expect(axios.post).toHaveBeenCalledOnce();
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { data: [{ id: 9 }] } }).mockResolvedValueOnce({ data: { id: 100 } });
    await submitNewShootWithEligibility(url, payload, config);
    expect(axios.post).toHaveBeenLastCalledWith(url, payload, config);
  });

  it('does not require a photographer for products with no on-site assignment', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 100 } });
    const noAssignment = { ...payload, services: [{ id: '3', photographer_id: null }] };
    await submitNewShootWithEligibility(url, noAssignment, config);
    expect(axios.post).toHaveBeenCalledExactlyOnceWith(url, noAssignment, config);
  });
});
