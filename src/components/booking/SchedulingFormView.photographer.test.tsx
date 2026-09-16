import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchedulingFormView } from './SchedulingFormView';
import type { SchedulingFormController } from './useSchedulingFormController';

vi.mock('./SchedulingPhotographerSection', () => ({
  SchedulingPhotographerSection: () => <div>Photographer picker</div>,
}));

afterEach(() => {
  cleanup();
});

function renderSchedule(requiresPhotographerAssignment: boolean) {
  const controller = {
    date: new Date('2026-10-05T12:00:00'),
    time: '10:00 AM',
    formErrors: {},
    handleSubmit: vi.fn(),
    goBack: vi.fn(),
    sameDayAddressWarningMessage: '',
    disabledDates: () => false,
    today: new Date('2026-10-05T12:00:00'),
    isMobile: false,
    timeDialogOpen: false,
    tempTime: '',
    availabilityPanel: null,
    suggestedTimesRailRef: { current: null },
    canScrollSuggestedTimesLeft: false,
    canScrollSuggestedTimesRight: false,
    calendarMonth: new Date('2026-10-05T12:00:00'),
    setCalendarMonth: vi.fn(),
    calendarAvailability: { loading: false },
    calendarAvailableDays: [],
    calendarUnavailableDays: [],
    onDateChange: vi.fn(),
    onTimeChange: vi.fn(),
    handleTimeDialogOpen: vi.fn(),
    handleTimeConfirm: vi.fn(),
    handleQuickTimeSelect: vi.fn(),
    photographer: '',
    isPhotographerTimeDisabled: () => false,
    availableTimesForSelectedPhotographer: [],
    suggestedTimes: ['10:00 AM'],
    updateSuggestedTimesScrollState: vi.fn(),
    scrollSuggestedTimesBy: vi.fn(),
    requiresPhotographerAssignment,
  } as unknown as SchedulingFormController;

  return render(<SchedulingFormView controller={controller} />);
}

describe('SchedulingFormView photographer gate', () => {
  it('does not ask for a photographer after date/time when no selected service needs one', () => {
    renderSchedule(false);

    expect(screen.queryByText('Photographer picker')).not.toBeInTheDocument();
  });

  it('asks for a photographer after date/time when a selected service needs one', () => {
    renderSchedule(true);

    expect(screen.getByText('Photographer picker')).toBeInTheDocument();
  });
});
