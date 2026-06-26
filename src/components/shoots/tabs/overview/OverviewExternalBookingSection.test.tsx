// Unit tests for the "External Booking Mapping" overview panel (Task 7.3, Req 2.22).
//
// The panel is purely presentational: it reads the external-booking columns that
// the backend ShootResource exposes and renders the preferred/alternate schedule,
// the auto-mapped per-service photographer + schedule, the requested photographers
// (resolved to names), the warnings, and the mapping-status badge.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { OverviewExternalBookingSection } from './OverviewExternalBookingSection';
import type { ShootData } from '@/types/shoots';

afterEach(() => {
  cleanup();
});

// Deterministic formatters so assertions don't depend on user-preference locale.
const formatDate = (value?: string | null) => (value ? `D(${value})` : 'Not set');
const formatTime = (value?: string | null) => (value ? `T(${value})` : 'Not set');

const baseShoot = (overrides: Partial<ShootData>): ShootData =>
  ({
    id: '1',
    scheduledDate: '2025-03-10',
    time: '09:00',
    photographer: { id: '7', name: 'Avery Lens' },
    serviceObjects: [],
    external_booking_mapping_status: 'needs_review',
    external_booking_payload: { source: 'external' },
    ...overrides,
  }) as unknown as ShootData;

describe('OverviewExternalBookingSection', () => {
  it('renders the mapping-status badge and preferred/alternate schedules', () => {
    render(
      <OverviewExternalBookingSection
        shoot={baseShoot({
          scheduledDate: '2025-03-10',
          time: '09:00',
          alternate_scheduled_date: '2025-03-12',
          alternate_time: '14:30',
          external_booking_mapping_status: 'partially_mapped',
        })}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );

    expect(screen.getByText('Partially mapped')).toBeInTheDocument();

    const preferred = screen.getByText('Preferred:').parentElement as HTMLElement;
    expect(within(preferred).getByText(/D\(2025-03-10\)/)).toBeInTheDocument();
    expect(within(preferred).getByText(/T\(09:00\)/)).toBeInTheDocument();

    const alternate = screen.getByText('Alternate:').parentElement as HTMLElement;
    expect(within(alternate).getByText(/D\(2025-03-12\)/)).toBeInTheDocument();
    expect(within(alternate).getByText(/T\(14:30\)/)).toBeInTheDocument();
  });

  it('shows "time not specified" when a schedule has a date but no time', () => {
    render(
      <OverviewExternalBookingSection
        shoot={baseShoot({
          scheduledDate: '2025-03-10',
          time: null as unknown as string,
          alternate_scheduled_date: null,
          alternate_time: null,
        })}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );

    const preferred = screen.getByText('Preferred:').parentElement as HTMLElement;
    expect(within(preferred).getByText('time not specified')).toBeInTheDocument();

    // Alternate has no date at all -> "Not provided".
    const alternate = screen.getByText('Alternate:').parentElement as HTMLElement;
    expect(within(alternate).getByText('Not provided')).toBeInTheDocument();
  });

  it('renders auto-mapped services with their per-service photographer and schedule', () => {
    render(
      <OverviewExternalBookingSection
        shoot={baseShoot({
          serviceObjects: [
            {
              id: 's1',
              name: 'HDR Photos',
              photographer: { id: '7', name: 'Avery Lens' },
              scheduled_at: '2025-03-10 09:00:00',
            },
            {
              id: 's2',
              name: 'Drone',
              photographer: null,
              scheduled_at: null,
            },
          ] as unknown as ShootData['serviceObjects'],
        })}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );

    expect(screen.getByText('Auto-mapped services')).toBeInTheDocument();

    expect(screen.getByText('HDR Photos')).toBeInTheDocument();
    expect(screen.getByText('Avery Lens')).toBeInTheDocument();

    // Service with no photographer / schedule falls back to safe labels.
    expect(screen.getByText('Drone')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Not scheduled')).toBeInTheDocument();
  });

  it('resolves requested photographer ids to names with a best-effort fallback', () => {
    render(
      <OverviewExternalBookingSection
        shoot={baseShoot({
          requested_photographers: [7, 99],
        })}
        formatDate={formatDate}
        formatTime={formatTime}
        resolvePhotographerName={(id) => (String(id) === '7' ? 'Avery Lens' : null)}
      />,
    );

    // id 7 resolves to a name; id 99 falls back to a "Photographer #99" label.
    expect(screen.getByText(/Avery Lens/)).toBeInTheDocument();
    expect(screen.getByText(/Photographer #99/)).toBeInTheDocument();
  });

  it('renders recorded warnings', () => {
    render(
      <OverviewExternalBookingSection
        shoot={baseShoot({
          external_booking_warnings: [
            'Multiple photographers requested for one service.',
            'Preferred date provided without a time.',
          ],
        })}
        formatDate={formatDate}
        formatTime={formatTime}
      />,
    );

    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(
      screen.getByText('Multiple photographers requested for one service.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Preferred date provided without a time.'),
    ).toBeInTheDocument();
  });
});
