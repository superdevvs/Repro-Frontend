import { describe, expect, it, vi } from 'vitest';

import { getBookingWizardConfig, scrollBookingPageToTop } from './bookShootModel';

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
