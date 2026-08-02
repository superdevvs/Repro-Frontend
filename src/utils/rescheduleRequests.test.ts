import { describe, expect, it } from 'vitest';

import {
  canReviewRescheduleRequests,
  describeRescheduleStatus,
  normalizeRescheduleStatus,
} from './rescheduleRequests';

/**
 * A1.docx item 4. The dialog's wording is driven by this role test, so if it
 * drifts the UI starts promising something the backend will not do — which is
 * the exact defect being fixed. Kept in step with
 * `ShootRescheduleRequestController::STAFF_ROLES`.
 */
describe('canReviewRescheduleRequests', () => {
  it.each(['admin', 'superadmin', 'super_admin', 'editing_manager'])(
    'treats %s as staff who reschedule directly',
    (role) => {
      expect(canReviewRescheduleRequests(role)).toBe(true);
    },
  );

  it.each(['client', 'photographer', 'editor', 'salesRep', 'rep', ''])(
    'treats %s as request-only',
    (role) => {
      expect(canReviewRescheduleRequests(role)).toBe(false);
    },
  );

  it('is case and whitespace insensitive', () => {
    expect(canReviewRescheduleRequests('  Admin ')).toBe(true);
    expect(canReviewRescheduleRequests('EDITING_MANAGER')).toBe(true);
  });

  it('treats a missing role as request-only', () => {
    expect(canReviewRescheduleRequests(undefined)).toBe(false);
    expect(canReviewRescheduleRequests(null)).toBe(false);
  });
});

describe('normalizeRescheduleStatus', () => {
  it('recognises the three states', () => {
    expect(normalizeRescheduleStatus('pending')).toBe('pending');
    expect(normalizeRescheduleStatus('approved')).toBe('approved');
    expect(normalizeRescheduleStatus('rejected')).toBe('rejected');
  });

  it('falls back to pending for anything unrecognised', () => {
    // Safer to show "waiting" than to imply a decision was made.
    expect(normalizeRescheduleStatus('something-else')).toBe('pending');
    expect(normalizeRescheduleStatus(null)).toBe('pending');
    expect(normalizeRescheduleStatus(undefined)).toBe('pending');
  });
});

describe('describeRescheduleStatus', () => {
  it('gives each state a distinct label and colour', () => {
    const pending = describeRescheduleStatus('pending');
    const approved = describeRescheduleStatus('approved');
    const rejected = describeRescheduleStatus('rejected');

    const labels = [pending.label, approved.label, rejected.label];
    expect(new Set(labels).size).toBe(3);

    const colours = [pending.className, approved.className, rejected.className];
    expect(new Set(colours).size).toBe(3);
  });

  it('states plainly that a pending request has not moved the shoot', () => {
    expect(describeRescheduleStatus('pending').description.toLowerCase()).toContain(
      'current date',
    );
  });

  it('states plainly that a rejected request left the shoot alone', () => {
    expect(describeRescheduleStatus('rejected').description.toLowerCase()).toContain(
      'original date',
    );
  });
});
