import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AvailabilityTimelineSlot } from './AvailabilityTimelineSlot';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AvailabilityTimelineSlot', () => {
  it('opens the same availability info on tap when hover is unavailable', async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    const onParentClick = vi.fn();

    render(
      <div role="button" tabIndex={0} onClick={onParentClick}>
        <AvailabilityTimelineSlot
          className="absolute inset-0"
          label="Booked 10:00 AM-11:00 AM"
          content="Booked · 10:00 AM-11:00 AM"
        />
      </div>,
    );

    await user.click(screen.getByRole('button', { name: 'Booked 10:00 AM-11:00 AM' }));
    expect(await screen.findByText('Booked · 10:00 AM-11:00 AM')).toBeVisible();
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('keeps hover tooltip path when pointer can hover', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();

    render(
      <TooltipProvider delayDuration={0}>
        <AvailabilityTimelineSlot
          className="inline-block h-2 w-8"
          label="Available 9:00 AM-10:00 AM"
          content="Available · 9:00 AM-10:00 AM"
        />
      </TooltipProvider>,
    );

    // Hover-capable path renders a non-button span trigger (tooltip, not popover).
    expect(screen.queryByRole('button', { name: 'Available 9:00 AM-10:00 AM' })).not.toBeInTheDocument();
    const trigger = document.querySelector('span.inline-block');
    expect(trigger).toBeTruthy();
    await user.hover(trigger as Element);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Available · 9:00 AM-10:00 AM');
  });
});
