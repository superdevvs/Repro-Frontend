import { describe, expect, it, vi } from 'vitest';

import {
  getBookingSubmissionPreflightIssue,
  getBookingWizardConfig,
  getSchedulingStepErrors,
  scrollBookingPageToTop,
} from './bookShootModel';

describe('scrollBookingPageToTop', () => {
  it('resets the dashboard main pane so the next booking slide starts at the top', () => {
    const root = document.createElement('div');
    const main = document.createElement('main');
    const button = document.createElement('button');
    Object.defineProperty(main, 'scrollTop', { value: 640, writable: true });
    root.appendChild(main);
    document.body.appendChild(root);
    document.body.appendChild(button);
    button.focus();
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);

    scrollBookingPageToTop(root);

    expect(main.scrollTop).toBe(0);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.activeElement).not.toBe(button);
    vi.unstubAllGlobals();
    root.remove();
    button.remove();
  });
});

describe('getSchedulingStepErrors', () => {
  it('lets digital-only bookings continue after date/time without a photographer', () => {
    expect(getSchedulingStepErrors({
      date: new Date('2026-10-05T12:00:00'),
      time: '10:00 AM',
      selectedServices: [{ id: 'vs', name: 'Virtual Staging', photographer_required: false }],
      photographer: '',
    })).toEqual({});
  });

  it('requires a photographer after date/time when a selected service needs one', () => {
    expect(getSchedulingStepErrors({
      date: new Date('2026-10-05T12:00:00'),
      time: '10:00 AM',
      selectedServices: [{ id: 'p', name: '25 HDR Photos', photographer_required: true }],
      photographer: '',
    })).toEqual({ photographer: 'Please select a photographer' });
  });
});

describe('getBookingSubmissionPreflightIssue', () => {
  const validBooking = {
    isClientAccount: false,
    client: 'client-1',
    address: '10 Monroe St',
    city: 'Rockville',
    state: 'MD',
    zip: '20850',
    date: new Date('2026-10-05T12:00:00'),
    time: '10:00 AM',
    selectedServices: [{ id: 'p', name: '25 HDR Photos', photographer_required: true }],
    photographer: 'photographer-1',
    servicePhotographers: {},
    isCompReshootMode: false,
    canCreateNoProductShoot: false,
  };

  it('returns the photographer-specific issue before generic required-field errors', () => {
    expect(getBookingSubmissionPreflightIssue({
      ...validBooking,
      photographer: '',
    })).toEqual({
      title: 'Photographer required',
      description: 'Please select a photographer',
      errors: { photographer: 'Please select a photographer' },
    });
  });

  it('returns no issue when all final booking requirements are complete', () => {
    expect(getBookingSubmissionPreflightIssue(validBooking)).toBeNull();
  });
});

describe('getBookingWizardConfig', () => {
  it('splits standard bookings into property, services, schedule, and review', () => {
    const wizard = getBookingWizardConfig(false);

    expect(wizard.totalSteps).toBe(4);
    expect(wizard.servicesStep).toBe(2);
    expect(wizard.schedulingStep).toBe(3);
    expect(wizard.finalStep).toBe(4);
    expect(wizard.labels).toEqual(['Property Details', 'Services', 'Schedule', 'Review']);
    expect(wizard.steps.map((step) => step.title)).toEqual([
      'Book a new shoot',
      'Services & access',
      'Schedule',
      'Review & Confirm',
    ]);
  });

  it('projects complimentary reshoots into the required four ordered steps', () => {
    const wizard = getBookingWizardConfig(true);

    expect(wizard.totalSteps).toBe(4);
    expect(wizard.servicesStep).toBe(2);
    expect(wizard.schedulingStep).toBe(3);
    expect(wizard.finalStep).toBe(4);
    expect(wizard.labels).toEqual(['Reason', 'Services & source', 'Schedule', 'Review']);
    expect(wizard.steps.map((step) => step.title)).toEqual([
      'Complimentary reshoot reason',
      'Services needing correction',
      'Schedule & assignments',
      'Review & compensation',
    ]);
  });
});
