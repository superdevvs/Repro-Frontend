import '@testing-library/jest-dom/vitest';
import React, { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchedulingPhotographerSection } from './SchedulingPhotographerSection';
import type { SchedulingFormController } from './useSchedulingFormController';

beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
  matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  addListener: vi.fn(), removeListener: vi.fn(),
})));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function Picker({ mobile = false, time = '10:00' }) {
  const [open, setOpen] = useState(false);
  const [photographer, setPhotographer] = useState('');
  const person = { id: '9', name: 'Pat Photographer' };
  const controller = {
    time, date: new Date('2026-10-05T12:00:00'), isMobile: mobile,
    photographerDialogOpen: open, setPhotographerDialogOpen: setOpen,
    handlePhotographerDialogOpen: (value: boolean) => { if (!value || time) setOpen(value); },
    photographer, setPhotographer,
    selectedPhotographer: photographer ? person : undefined,
    selectedPhotographerDetails: photographer ? person : undefined,
    handleConfirmPhotographer: () => setOpen(false),
    toast: vi.fn(), selectedServices: [], assignmentGroups: [],
    requiresPerServiceAssignment: false,
    availabilityStats: { total: 1, available: 1 },
    availabilityCardWindow: { startMinutes: 480, endMinutes: 1140 },
    photographerAvailability: new Map(), filteredAndSortedPhotographers: [person],
    searchQuery: '', sortBy: 'distance', formatLocationLabel: () => '',
    minutesToTime: (value: number) => `${Math.floor(value / 60)}:00`,
  } as unknown as SchedulingFormController;
  return <><output data-testid="selection-state">{photographer}:{String(open)}</output><SchedulingPhotographerSection controller={controller} /></>;
}

describe('booking photographer picker', () => {
  it.each([false, true])('opens and confirms a photographer (mobile=%s)', async (mobile) => {
    const user = userEvent.setup();
    render(<Picker mobile={mobile} />);
    await user.click(screen.getByText('Select a photographer'));
    expect(await screen.findByRole('dialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Pat Photographer/ }));
    await user.click(screen.getByRole('button', { name: 'Confirm Assignment' }));
    expect(screen.getByTestId('selection-state')).toHaveTextContent('9:false');
  });

  it('requires a time before opening', async () => {
    render(<Picker time="" />);
    await userEvent.click(screen.getByText('Select a photographer'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
