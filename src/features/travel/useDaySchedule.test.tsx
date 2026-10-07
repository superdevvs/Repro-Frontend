import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useDayPreview } from './useDaySchedule';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('requests itinerary details for an unchanged edit without altering the save payload', async () => {
  const route = { id: 'incoming', source: 'google_routes', drive_minutes: 30, distance_miles: 10.08, required_minutes: 35, available_minutes: 45 };
  const fetchPreview = vi.fn(async (_url: string, options: RequestInit) => {
    const request = JSON.parse(String(options.body));
    return { ok: true, json: async () => ({ data: { enabled: true, status: 'available', available: true,
      transitions: request.action_mode === 'update' ? [] : [route] } }) };
  });
  vi.stubGlobal('fetch', fetchPreview);
  const payload = { action_mode: 'update', shoot_id: 526, scheduled_at: '2026-10-09T12:00:00', timezone: null };
  const { result } = renderHook(() => useDayPreview(payload, false));
  await waitFor(() => expect(result.current.result?.transitions).toEqual([route]));
  expect(JSON.parse(String(fetchPreview.mock.calls[0][1].body))).toEqual({ ...payload, action_mode: 'schedule' });
  expect(payload.action_mode).toBe('update');
});
