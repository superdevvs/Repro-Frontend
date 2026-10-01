import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotographerAvailabilityTimeline } from './PhotographerAvailabilityTimeline';

beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
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

  it('opens authorized booking details with a mouse without selecting the photographer', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const user = userEvent.setup();
    const selectPhotographer = vi.fn();
    render(
      <button type="button" onClick={selectPhotographer}>
        <PhotographerAvailabilityTimeline bookedSlots={[{
          start_time: '10:00', end_time: '11:00', client_name: 'Sample Client',
          address: '118 Example Lane', city: 'Baltimore', state: 'MD', zip: '21201',
          services: [{ id: 1, name: 'HDR Photography' }, { id: 2, name: 'Floor Plan' }],
        }]} />
      </button>,
    );

    await user.click(screen.getByRole('button', { name: 'Booked 10:00 AM-11:00 AM' }));
    const details = await screen.findByRole('dialog', { name: 'Booked 10:00 AM-11:00 AM' });
    expect(within(details).getByText('Sample Client')).toBeVisible();
    expect(within(details).getByText('118 Example Lane, Baltimore, MD 21201')).toBeVisible();
    expect(within(details).getByText('HDR Photography · Floor Plan')).toBeVisible();
    expect(within(details).getByText('10:00 AM')).toBeVisible();
    expect(within(details).getByText('11:00 AM')).toBeVisible();
    expect(selectPhotographer).not.toHaveBeenCalled();
    await user.click(details);
    expect(selectPhotographer).not.toHaveBeenCalled();
  });

  it('supports Enter, Escape and Space without activating the surrounding picker', async () => {
    const user = userEvent.setup();
    const parentKey = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onKeyDown={parentKey} onClick={parentClick}>
        <PhotographerAvailabilityTimeline bookedSlots={[{ start_time: '10:00', end_time: '11:00' }]} />
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Booked 10:00 AM-11:00 AM' });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.keyboard(' ');
    expect(await screen.findByRole('dialog')).toBeVisible();
    expect(parentKey).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('shows only times when identifying booking details were omitted by the API', async () => {
    const user = userEvent.setup();
    render(<PhotographerAvailabilityTimeline bookedSlots={[{ start_time: '10:00', end_time: '11:00' }]} />);
    await user.click(screen.getByRole('button', { name: 'Booked 10:00 AM-11:00 AM' }));
    const details = within(await screen.findByRole('dialog'));
    expect(details.getByText('Start')).toBeVisible();
    expect(details.getByText('End')).toBeVisible();
    expect(details.queryByText('Client')).not.toBeInTheDocument();
    expect(details.queryByText('Address')).not.toBeInTheDocument();
    expect(details.queryByText('Service')).not.toBeInTheDocument();
  });

  it('retains actual appointment times when the visible bar is clipped and constrains mobile details', async () => {
    const user = userEvent.setup();
    render(<PhotographerAvailabilityTimeline startMinutes={8 * 60} endMinutes={18 * 60}
      bookedSlots={[{ start_time: '07:30', end_time: '09:00', address: 'A long property address that wraps on a narrow mobile viewport' }]} />);
    const trigger = screen.getByRole('button', { name: 'Booked 7:30 AM-9:00 AM' });
    expect(trigger).toHaveStyle({ left: '0%', width: '10%' });
    await user.click(trigger);
    const details = await screen.findByRole('dialog');
    expect(within(details).getByText('7:30 AM')).toBeVisible();
    expect(details).toHaveClass('max-w-[calc(100vw-2rem)]', 'whitespace-normal');
  });
});
