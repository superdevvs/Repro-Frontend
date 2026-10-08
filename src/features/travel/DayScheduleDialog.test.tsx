import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DayScheduleDialog } from './DayScheduleDialog';
import { useDaySchedule, useDayPreview } from './useDaySchedule';
import type { TravelController } from './useTravelFeasibility';
import type { TravelFeasibility } from './types';

vi.mock('./useDaySchedule', () => ({ useDaySchedule: vi.fn(), useDayPreview: vi.fn() }));
vi.mock('./DayScheduleTimeline', () => ({ DayScheduleTimeline: () => <div>Booking timeline</div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function setup(reason: string, override = false) {
  const visit = { photographer_id: 989, start: '2026-10-10T12:15:00Z', end: '2026-10-10T14:30:00Z',
    scheduled_at: '2026-10-10T12:15:00Z', duration_minutes: 135, timezone: 'America/New_York' };
  const result: TravelFeasibility = { enabled: true, available: false, status: 'conflict', reason_codes: [reason],
    can_override: override, confirmation_version: override ? 'confirmed-version' : undefined,
    policy_version: '1', schedule_version: '1', transitions: [], alternatives: [], visits: [visit] };
  const travel = { result, payload: { shoot_id: 2401, address: '2507 Baltimore Road Unit 1', photographer_id: 989 },
    notifications: { client: false, photographer: false }, scheduleAdjustments: [], requestedOnly: false,
    onScheduleChange: vi.fn(), setScheduleAdjustments: vi.fn(), setNotifications: vi.fn() } as unknown as TravelController;
  vi.mocked(useDaySchedule).mockReturnValue({ data: { date: '2026-10-10', timezone: 'America/New_York',
    photographer: { id: 989, name: 'Jay Snap' }, bookings: [], schedule_version: '1' }, error: '' });
  vi.mocked(useDayPreview).mockReturnValue({ result, loading: false, error: '' });
  const close = vi.fn();
  render(<DayScheduleDialog travel={travel} open onClose={close} />);
  return { travel, close };
}

it('explains working-hour rejection and prevents selecting that schedule', () => {
  const { travel } = setup('outside_working_hours');
  expect(screen.getByText(/outside the photographer’s working hours/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use this schedule' })).toBeDisabled();
  expect(travel.onScheduleChange).not.toHaveBeenCalled();
});

it('explains a server overlap even when the visible timeline has no overlapping card', () => {
  setup('capture_overlap');
  expect(screen.getByText(/photographer has another booking at this time/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use this schedule' })).toBeDisabled();
});

it('allows staging a shorter travel gap when the server grants explicit confirmation', () => {
  const { travel, close } = setup('insufficient_travel_time', true);
  fireEvent.click(screen.getByRole('button', { name: 'Use schedule · review travel on save' }));
  expect(travel.onScheduleChange).toHaveBeenCalledWith({ scheduledAt: '2026-10-10T12:15:00Z', offsetMinutes: 0, timezone: 'America/New_York' });
  expect(travel.setNotifications).toHaveBeenCalledWith({ client: false, photographer: false });
  expect(close).toHaveBeenCalledOnce();
});
