import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDurationAwareAvailability, photographerVisitDurationGroups } from './photographerVisitDuration';
afterEach(() => vi.unstubAllGlobals());
describe('candidate photographer capture time', () => {
  const services = [{ id: 'photo', shoot_duration_minutes: 15, assignedPhotographerId: '9', moving: true },
    { id: 'video', shoot_duration_minutes: 30, assignedPhotographerId: '9', moving: false }];
  it('includes destination work across categories and leaves an otherwise free candidate at15', () => {
    expect(photographerVisitDurationGroups(services, ['9', '10', '11'], '2026-10-05', '09:00', 1000, {})).toEqual([
      { photographer_ids: [9], duration_minutes: 45 }, { photographer_ids: [10, 11], duration_minutes: 15 },
    ]);
    expect(photographerVisitDurationGroups(services, ['9'], '2026-10-05', '09:00', 1000, { video: { time: '10:00' } })[0].duration_minutes).toBe(15);
  });
  it('requests equal-duration candidates together and merges their availability without losing assignments', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { photographer_ids: number[] };
      return new Response(JSON.stringify({ data: body.photographer_ids.map(id => ({ id })) }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const groups = photographerVisitDurationGroups(services, ['9', '10', '11'], '2026-10-05', '09:00', 1000, {});
    const response = await fetchDurationAwareAvailability('/availability', { method: 'POST', body: JSON.stringify({ date: '2026-10-05' }) }, groups);
    expect(await response.json()).toEqual({ data: [{ id: 9 }, { id: 10 }, { id: 11 }] });
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { date: '2026-10-05', photographer_ids: [9], duration_minutes: 45 }, { date: '2026-10-05', photographer_ids: [10, 11], duration_minutes: 15 },
    ]);
  });
});
