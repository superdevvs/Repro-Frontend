import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayScheduleTimeline } from './DayScheduleTimeline';
import { atMinute, localSchedule, overlaps, shiftTravelPayload, sameDayTransitions, type DayBooking } from './daySchedule';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const row: DayBooking = { id: 'target', start: '2026-10-09T13:00:00Z', end: '2026-10-09T15:15:00Z', duration_minutes: 135,
  photographer_id: 989, label: '4421 Bradley Lane', shoot_id: null, expected_edit_version: null, can_adjust: true, target: true };
function Harness({ initial = row, desktop = true }: { initial?: DayBooking; desktop?: boolean }) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const [bookings, setBookings] = useState([initial]);
  return <DayScheduleTimeline bookings={bookings} date="2026-10-09" timezone="America/New_York" onDragging={vi.fn()} onError={vi.fn()}
    onMove={(id, start) => setBookings(current => current.map(value => value.id === id ? { ...value, start, end: new Date(Date.parse(start) + value.duration_minutes * 60000).toISOString() } : value))} />;
}
describe('day schedule adjustment', () => {
  it('moves the shoot by keyboard down to 8 AM and preserves its duration', () => {
    const scroll = vi.fn(); Element.prototype.scrollTo = scroll;
    render(<Harness />);
    const booking = screen.getByRole('button', { name: /Bradley Lane/ });
    for (let i = 0; i < 8; i++) fireEvent.keyDown(booking, { key: 'ArrowLeft' });
    expect(booking).toHaveTextContent('8 AM–10:15 AM');
    expect(booking).toHaveClass('target');
    expect(screen.getByLabelText(/booking timeline/)).toHaveClass('horizontal');
    expect(scroll).toHaveBeenCalledWith({ left: 720, top: 0 });
  });
  it('automatically focuses a 4 AM shoot in the vertical phone layout', () => {
    const scroll = vi.fn(); Element.prototype.scrollTo = scroll;
    render(<Harness desktop={false} initial={{ ...row, start: '2026-10-09T08:00:00Z', end: '2026-10-09T10:15:00Z' }} />);
    expect(screen.getByLabelText(/booking timeline/)).toHaveClass('vertical');
    expect(scroll).toHaveBeenCalledWith({ top: 136.5, left: 0 });
    expect(screen.getByRole('button')).toHaveTextContent('4 AM–6:15 AM');
  });
  it('keeps inaccessible existing appointments read only', () => {
    Element.prototype.scrollTo = vi.fn();
    render(<Harness initial={{ ...row, target: false, label: 'Booked', can_adjust: false }} />);
    const booking = screen.getByRole('button');
    fireEvent.keyDown(booking, { key: 'ArrowRight' });
    expect(booking).toHaveAttribute('aria-disabled', 'true'); expect(booking).toHaveTextContent('9 AM–11:15 AM');
  });
  it('uses instants for overlap checks and refuses nonexistent or ambiguous DST clocks', () => {
    expect(overlaps([row, { ...row, id: 'second', start: '2026-10-09T14:00:00Z' }])).toBe(true);
    expect(overlaps([row, { ...row, id: 'second', start: row.end, end: '2026-10-09T18:00:00Z' }])).toBe(false);
    expect(() => atMinute('2026-03-08', 150, 'America/New_York')).toThrow(/does not exist/);
    expect(() => atMinute('2026-11-01', 90, 'America/New_York')).toThrow(/occurs twice/);
  });
  it('shifts both zoned and legacy floating service times without changing storage convention', () => {
    const zoned = shiftTravelPayload({ timezone: 'America/New_York', scheduled_at: row.start, service_items: [{ scheduled_at: row.start }] }, 45, 'America/New_York');
    expect(localSchedule(String(zoned.scheduled_at), 'America/New_York').time).toBe('09:45');
    const floating = shiftTravelPayload({ timezone: null, scheduled_at: '2026-10-09T09:00:00Z', service_items: [{ scheduled_at: '2026-10-09T09:00:00Z' }] }, 45, 'America/New_York');
    expect(floating.scheduled_at).toBe('2026-10-09T09:45:00'); expect(floating.service_items).toEqual([{ scheduled_at: '2026-10-09T09:45:00' }]);
  });
  it('omits yesterday and tomorrow from the confirmation while retaining this date', () => {
    const leg = { id: 'a', direction: 'incoming' as const, source: 'google_routes' as const, required_minutes: 35, available_minutes: 45,
      shortfall_minutes: 0, reason_code: 'available', candidate_start: row.start,
      neighbor: { shoot_id: 1, scheduled_at: '2026-10-08T13:00:00Z', end_at: '2026-10-08T15:15:00Z', timezone: 'America/New_York', services: [], can_view_details: true as const } };
    expect(sameDayTransitions([leg, { ...leg, id: 'b', neighbor: { ...leg.neighbor, scheduled_at: '2026-10-09T12:00:00Z' } },
      { ...leg, id: 'c', neighbor: { ...leg.neighbor, scheduled_at: '2026-10-10T12:00:00Z' } }], 'America/New_York').map(value => value.id)).toEqual(['b']);
  });
});
