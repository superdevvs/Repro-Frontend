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
  const travel = { result, payload: { shoot_id: 2401, address: '2507 Baltimore Road Unit 1', photographer_id: 989, timezone: 'America/New_York',
    scheduled_at: visit.start, service_items: [{ service_id: 12, service_name: 'Current photos', photographer_id: 989, scheduled_at: visit.start, duration_minutes: 135 }] },
    notifications: { client: false, photographer: false }, scheduleAdjustments: [], requestedOnly: false,
    onScheduleChange: vi.fn(), setScheduleAdjustments: vi.fn(), setNotifications: vi.fn() } as unknown as TravelController;
  vi.mocked(useDaySchedule).mockReturnValue({ data: { date: '2026-10-10', timezone: 'America/New_York',
    photographer: { id: 989, name: 'Jay Snap' }, bookings: [{ id: 'prior', start: '2026-10-10T11:00:00Z', end: '2026-10-10T12:00:00Z', duration_minutes: 60,
      photographer_id: 989, label: 'Previous property', shoot_id: 2200, can_adjust: true, expected_edit_version: 'version',
      duration_items: [{ key: '77', name: 'Prior photos', duration_minutes: 60 }] }], schedule_version: '1' }, error: '' });
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

it('stages only the selected current booking duration and rechecks its preview', () => {
  const { travel } = setup('insufficient_travel_time', true);
  fireEvent.change(screen.getByRole('slider', { name: 'Shoot duration for Current photos' }), { target: { value: '90' } });
  expect(screen.getByText(/Selected booking: 90 min/)).toBeInTheDocument();
  expect(vi.mocked(useDayPreview).mock.lastCall?.[0]).toMatchObject({ service_items: [{ duration_minutes: 90 }] });
  fireEvent.click(screen.getByRole('button', { name: 'Use schedule · review travel on save' }));
  expect(travel.onScheduleChange).toHaveBeenCalledWith(expect.objectContaining({ serviceDurations: { '12': 90 } }));
  expect(travel.setScheduleAdjustments).toHaveBeenCalledWith([]);
});

it('changes a previous booking duration without changing the current booking', () => {
  const { travel } = setup('insufficient_travel_time', true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Allow changes to existing bookings' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Booking to adjust' }), { target: { value: 'prior' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Shoot duration for Prior photos' }), { target: { value: '30' } });
  expect(vi.mocked(useDayPreview).mock.lastCall?.[0]).toMatchObject({ service_items: [{ duration_minutes: 135 }],
    schedule_adjustments: [{ shoot_id: 2200, service_durations: [{ shoot_service_id: 77, duration_minutes: 30 }] }] });
  fireEvent.click(screen.getByRole('button', { name: 'Use schedule · review travel on save' }));
  expect(travel.onScheduleChange).toHaveBeenCalledWith(expect.not.objectContaining({ serviceDurations: expect.anything() }));
  expect(travel.setScheduleAdjustments).toHaveBeenCalledWith([expect.objectContaining({ shoot_id: 2200,
    service_durations: [{ shoot_service_id: 77, duration_minutes: 30 }] })]);
});

it('blocks invalid custom duration and discards edits on cancel', () => {
  const { travel, close } = setup('insufficient_travel_time', true);
  fireEvent.click(screen.getByRole('button', { name: 'Set custom duration for Current photos' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Custom duration for Current photos' }), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: 'Use this schedule' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
  expect(close).toHaveBeenCalled(); expect(travel.onScheduleChange).not.toHaveBeenCalled();
});

it('prevents increasing the previous duration into the selected shoot', () => {
  setup('insufficient_travel_time', true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Allow changes to existing bookings' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Booking to adjust' }), { target: { value: 'prior' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Shoot duration for Prior photos' }), { target: { value: '90' } });
  expect(screen.getByText(/Bookings overlap/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use this schedule' })).toBeDisabled();
});

it('explains a server overlap even when the visible timeline has no overlapping card', () => {
  setup('capture_overlap');
  expect(screen.getByText(/photographer has another booking at this time/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Use this schedule' })).toBeDisabled();
});

it('allows staging a shorter travel gap when the server grants explicit confirmation', () => {
  const { travel, close } = setup('insufficient_travel_time', true);
  fireEvent.click(screen.getByRole('button', { name: 'Use schedule · review travel on save' }));
  expect(travel.onScheduleChange).toHaveBeenCalledWith(expect.objectContaining({ scheduledAt: '2026-10-10T12:15:00Z', offsetMinutes: 0, timezone: 'America/New_York', photographerId: 989, fromStart: '2026-10-10T12:15:00Z' }));
  expect(travel.setNotifications).toHaveBeenCalledWith({ client: false, photographer: false });
  expect(close).toHaveBeenCalledOnce();
});
