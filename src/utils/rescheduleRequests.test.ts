import { describe, expect, it } from 'vitest';

import {
  canReviewRescheduleRequests,
  getRescheduleAccess,
  describeRescheduleStatus,
  normalizeRescheduleStatus,
} from './rescheduleRequests';

const permissions = { canManageRequests: true, canEditAppointments: true, isLoading: false };

describe('canReviewRescheduleRequests', () => {
  it.each([
    'admin',
    'superadmin',
    'super_admin',
    'editing_manager',
    'salesRep',
    'sales_rep',
    'salesrep',
    'rep',
    'representative',
  ])(
    'allows %s to review with an effective management grant',
    (role) => {
      expect(canReviewRescheduleRequests({ role }, permissions)).toBe(true);
    },
  );

  it.each(['client', 'photographer', 'editor', ''])(
    'treats %s as request-only',
    (role) => {
      expect(canReviewRescheduleRequests({ role }, permissions)).toBe(false);
    },
  );

  it('is case and whitespace insensitive', () => {
    expect(canReviewRescheduleRequests({ role: '  Admin ' }, permissions)).toBe(true);
    expect(canReviewRescheduleRequests({ role: 'EDITING_MANAGER' }, permissions)).toBe(true);
  });

  it('treats a missing role as request-only', () => {
    expect(canReviewRescheduleRequests(undefined, permissions)).toBe(false);
    expect(canReviewRescheduleRequests(null, permissions)).toBe(false);
  });

  it.each(['client', 'editor', 'photographer'])('recognizes a secondary sales role for %s', role => {
    expect(canReviewRescheduleRequests({ role, secondary_roles: ['sales_rep'] }, permissions)).toBe(true);
  });

  it.each(['admin', 'editing_manager', 'salesRep'])('honors an effective management denial for %s', role => {
    expect(canReviewRescheduleRequests({ role }, { ...permissions, canManageRequests: false })).toBe(false);
  });

  it('fails closed while permissions load or fail, including superadmin', () => {
    expect(canReviewRescheduleRequests({ role: 'superadmin' }, { ...permissions, isLoading: true })).toBe(false);
    expect(canReviewRescheduleRequests({ role: 'superadmin' }, { ...permissions, hasError: true })).toBe(false);
  });
});

describe('getRescheduleAccess', () => {
  it('applies a server-authorized appointment change for a secondary sales rep', () => {
    expect(getRescheduleAccess({ canApproveReschedule: true, canRequestReschedule: false },
      { role: 'editor', secondary_roles: ['representative'] }, permissions)).toBe('apply');
  });
  it('lets a reviewer with denied edit rights reject requests without promising an immediate move', () => {
    const deniedEdit = { ...permissions, canEditAppointments: false };
    expect(canReviewRescheduleRequests({ role: 'salesRep' }, deniedEdit)).toBe(true);
    expect(getRescheduleAccess({ canApproveReschedule: true, canRequestReschedule: true }, { role: 'salesRep' }, deniedEdit)).toBe('denied');
  });
  it('requires server appointment scope, not only a role or permission grant', () => {
    expect(getRescheduleAccess({ canApproveReschedule: false, canRequestReschedule: false }, { role: 'admin' }, permissions)).toBe('denied');
    expect(getRescheduleAccess({}, { role: 'admin' }, permissions)).toBe('unavailable');
  });
  it.each(['client', 'photographer', 'editor'])('keeps an authorized %s request pending', role => {
    expect(getRescheduleAccess({ canApproveReschedule: false, canRequestReschedule: true }, { role }, permissions)).toBe('request');
    expect(getRescheduleAccess({ canRequestReschedule: false }, { role }, permissions)).toBe('denied');
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
