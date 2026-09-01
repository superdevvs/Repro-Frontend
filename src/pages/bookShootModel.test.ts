import { describe, expect, it } from 'vitest';

import { getBookingWizardConfig } from './bookShootModel';

describe('getBookingWizardConfig', () => {
  it('keeps standard bookings on the existing three-step flow', () => {
    const wizard = getBookingWizardConfig(false);

    expect(wizard.totalSteps).toBe(3);
    expect(wizard.schedulingStep).toBe(2);
    expect(wizard.finalStep).toBe(3);
    expect(wizard.labels).toBeUndefined();
    expect(wizard.steps.map((step) => step.title)).toEqual([
      'Book a new shoot',
      'Schedule',
      'Review & Confirm',
    ]);
  });

  it('projects complimentary reshoots into the required four ordered steps', () => {
    const wizard = getBookingWizardConfig(true);

    expect(wizard.totalSteps).toBe(4);
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
