import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchedulingFormView } from './SchedulingFormView';
import type { SchedulingFormController } from './useSchedulingFormController';

vi.mock('./SchedulingPhotographerSection', () => ({
  SchedulingPhotographerSection: ({ controller }: { controller: SchedulingFormController }) => <div>Service schedules{controller.requiresPhotographerAssignment && <span>Photographer picker</span>}</div>,
}));

afterEach(() => {
  cleanup();
});

function renderSchedule(requiresPhotographerAssignment: boolean, showStandaloneTime = false) {
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
    showStandaloneTime,
    selectedServices: [{ id: '1', name: 'Test service', photographer_required: requiresPhotographerAssignment }],
  } as unknown as SchedulingFormController;

  return render(<SchedulingFormView controller={controller} />);
}

describe('SchedulingFormView photographer gate', () => {
  it('does not ask for a photographer after date/time when no selected service needs one', () => {
    renderSchedule(false);

    expect(screen.queryByText('Photographer picker')).not.toBeInTheDocument();
    expect(screen.getByText('Service schedules')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Time$/ })).not.toBeInTheDocument();
  });

  it('asks for a photographer after date/time when a selected service needs one', () => {
    renderSchedule(true);

    expect(screen.getByText('Photographer picker')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Time$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose manually' })).not.toBeInTheDocument();
  });

  it('uses service schedules for a mixed booking without the separate time card', () => {
    renderSchedule(true, false);

    expect(screen.getByText('Photographer picker')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose manually' })).not.toBeInTheDocument();
  });
});
