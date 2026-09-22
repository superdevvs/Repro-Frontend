import '@testing-library/jest-dom/vitest';
import React, { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
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

type PickerProps = {
  mobile?: boolean;
  time?: string;
  overrides?: Record<string, unknown>;
};

function Picker({ mobile = false, time = '10:00', overrides = {} }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [photographer, setPhotographer] = useState('');
  const person = { id: '9', name: 'Pat Photographer' };
  const controller = {
    time, date: new Date('2026-10-05T12:00:00'), isMobile: mobile,
    photographerDialogOpen: open, setPhotographerDialogOpen: setOpen,
    handlePhotographerDialogOpen: (value: boolean) => { if (!value || time) setOpen(value); },
    photographer, setPhotographer, canConfirmPhotographer: Boolean(photographer),
    selectedPhotographer: photographer ? person : undefined,
    selectedPhotographerDetails: photographer ? person : undefined,
    handleConfirmPhotographer: () => setOpen(false),
    toast: vi.fn(), selectedServices: [], assignmentGroups: [],
    requiresPerServiceAssignment: false,
    formErrors: {},
    getServiceSchedule: () => ({ date: '2026-09-18', time: '10:15' }),
    updateServiceSchedules: vi.fn(),
    formatScheduleLine: () => '2026-09-18 at 10:15 AM',
    buildConflictAwareServiceTimeOptions: () => [],
    isPhotographerTimeDisabled: () => false,
    availabilityStats: { total: 1, available: 1 },
    availabilityCardWindow: { startMinutes: 480, endMinutes: 1140 },
    photographerAvailability: new Map(), filteredAndSortedPhotographers: [person],
    searchQuery: '', sortBy: 'distance', formatLocationLabel: () => '',
    minutesToTime: (value: number) => `${Math.floor(value / 60)}:00`,
    ...overrides,
  } as unknown as SchedulingFormController;
  return <><output data-testid="selection-state">{photographer}:{String(open)}</output><SchedulingPhotographerSection controller={controller} /></>;
}

const flashPhotos = { id: 'p', name: '25 Flash Photos', price: 150, photographer_required: true, category: { id: '1', name: 'Photos' } };
const staging = { id: 'vs', name: 'Virtual Staging (per image)', price: 45, photographer_required: false };
const verticalVideo = { id: 'sv', name: 'Social Media Vertical Video - Basic', price: 90, photographer_required: false };
const mixedSelection = {
  selectedServices: [staging, flashPhotos, verticalVideo],
  assignmentGroups: [{ key: 'p', serviceId: 'p', serviceName: '25 Flash Photos', categoryName: 'Photos' }],
};

describe('booking photographer picker', () => {
  it('shows a failed eligibility check with retry and disables confirmation', async () => {
    const retry = vi.fn();
    render(<Picker overrides={{
      bookingEligibilityError: 'Could not check photographer eligibility. Please try again.',
      retryBookingEligibility: retry, canConfirmPhotographer: false,
    }} />);
    await userEvent.click(screen.getByText('Select a photographer'));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not check photographer eligibility');
    expect(screen.getByRole('button', { name: 'Confirm Assignment' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
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

  it('ties the photographer to the only service that needs one and lists the rest separately', () => {
    render(<Picker overrides={mixedSelection} />);

    const photographerCard = screen.getByRole('region', { name: 'Photographer' });
    expect(within(photographerCard).getByText('Only 25 Flash Photos needs a photographer.')).toBeInTheDocument();
    expect(within(photographerCard).getByText('25 Flash Photos')).toBeInTheDocument();
    expect(within(photographerCard).getByText('Select a photographer')).toBeInTheDocument();
    expect(within(photographerCard).queryByText('Virtual Staging (per image)')).not.toBeInTheDocument();
    expect(within(photographerCard).queryByText('Social Media Vertical Video - Basic')).not.toBeInTheDocument();

    const otherCard = screen.getByRole('region', { name: 'Other service schedules' });
    expect(within(otherCard).getByText('Virtual Staging (per image)')).toBeInTheDocument();
    expect(within(otherCard).getByText('Social Media Vertical Video - Basic')).toBeInTheDocument();
    expect(within(otherCard).queryByText('25 Flash Photos')).not.toBeInTheDocument();
    expect(within(otherCard).queryByText('Select a photographer')).not.toBeInTheDocument();
  });

  it('keeps a single photographer-only booking to the photographer card', () => {
    render(<Picker overrides={{ selectedServices: [flashPhotos], assignmentGroups: mixedSelection.assignmentGroups }} />);

    const photographerCard = screen.getByRole('region', { name: 'Photographer' });
    expect(within(photographerCard).getByText('Assign a photographer for 25 Flash Photos.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Other service schedules' })).not.toBeInTheDocument();
  });

  it.each([false, true])('shows clients distance without location (mobile=%s)', async (mobile) => {
    const user = userEvent.setup();
    render(<Picker mobile={mobile} overrides={{
      showPhotographerAddress: false,
      filteredAndSortedPhotographers: [{
        id: '9',
        name: 'Jay Snap',
        city: 'Rockville',
        state: 'MD',
        address: '10 Private Lane',
        serviceAreaLabel: 'Rockville, MD',
        distance: 12.4,
      }],
    }} />);

    await user.click(screen.getByText('Select a photographer'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('12.4 mi away')).toBeInTheDocument();
    expect(within(dialog).queryByText('Rockville, MD')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('10 Private Lane')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Service area unavailable')).not.toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText('Search by name...')).toBeInTheDocument();
  });

  it('shows an unavailable distance without falling back to a private location', async () => {
    render(<Picker overrides={{
      showPhotographerAddress: false,
      filteredAndSortedPhotographers: [{ id: '9', name: 'Jay Snap', serviceAreaLabel: 'Private area' }],
    }} />);
    await userEvent.click(screen.getByText('Select a photographer'));
    expect(screen.getByText('Distance unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Private area')).not.toBeInTheDocument();
  });

  it('shows sales reps and admins the photographer location', async () => {
    const user = userEvent.setup();
    render(<Picker overrides={{
      showPhotographerAddress: true,
      filteredAndSortedPhotographers: [{
        id: '9',
        name: 'Jay Snap',
        serviceAreaLabel: 'Rockville, MD',
        distance: 12.4,
      }],
    }} />);

    await user.click(screen.getByText('Select a photographer'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Rockville, MD')).toBeInTheDocument();
    expect(within(dialog).getByText('12.4 mi')).toBeInTheDocument();
    expect(within(dialog).queryByText('12.4 mi away')).not.toBeInTheDocument();
  });

  it('shows the photographer validation error inside the photographer card', () => {
    render(<Picker overrides={{ ...mixedSelection, formErrors: { photographer: 'Please select a photographer' } }} />);

    const photographerCard = screen.getByRole('region', { name: 'Photographer' });
    expect(within(photographerCard).getByText('Please select a photographer')).toBeInTheDocument();
  });
});
