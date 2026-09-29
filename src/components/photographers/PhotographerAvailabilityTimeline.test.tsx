import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotographerAvailabilityTimeline } from './PhotographerAvailabilityTimeline';

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PhotographerAvailabilityTimeline', () => {
  it('renders green Available / blue Booked / red N/A labeled segments', () => {
    render(
      <PhotographerAvailabilityTimeline
        availableSlots={[{ start_time: '09:00', end_time: '12:00' }]}
        bookedSlots={[{ start_time: '12:00', end_time: '14:00' }]}
        unavailableSlots={[{ start_time: '14:00', end_time: '16:00' }]}
      />,
    );

    const available = screen.getByLabelText('Available 9:00 AM-12:00 PM');
    const booked = screen.getByLabelText('Booked 12:00 PM-2:00 PM');
    const unavailable = screen.getByLabelText('N/A 2:00 PM-4:00 PM');
    expect(available).toHaveClass('bg-emerald-500');
    expect(booked).toHaveClass('bg-blue-500');
    expect(unavailable).toHaveClass('bg-red-500');
    expect(available).toHaveTextContent('Available');
    expect(booked).toHaveTextContent('Booked');
    expect(unavailable).toHaveTextContent('N/A');
  });

  it('shows loading hint only when there are no status segments', () => {
    const { rerender } = render(
      <PhotographerAvailabilityTimeline loadingHint="Checking availability..." />,
    );
    expect(screen.getByText('Checking availability...')).toBeInTheDocument();

    rerender(
      <PhotographerAvailabilityTimeline
        loadingHint="Checking availability..."
        availableSlots={[{ start_time: '10:00', end_time: '11:00' }]}
      />,
    );
    expect(screen.queryByText('Checking availability...')).not.toBeInTheDocument();
  });
});
