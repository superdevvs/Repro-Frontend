import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudioPendingBilling } from './StudioPendingBilling';
import fixture from './studioFixtures.test-data.json';
import { billingRequest } from '../staff/staffFixtures.test-data';
import type { StudioAccount } from '@/types/listingStudioClient';
afterEach(cleanup);
describe('client pending billing visibility', () => {
  it('shows a scheduled lower plan while preserving current-period benefits', () => {
    const account = { ...fixture.account, subscriptionManagement: { pendingChange: { id: '1', type: 'schedule_downgrade', status: 'scheduled', planCode: 'starter', currentPlanCode: 'pro', effectiveAt: '2026-11-30T12:00:00Z', errorCode: null }, capabilities: { canScheduleDowngrade: false, canCancelRenewal: false, canUndoCancel: false, canUndoDowngrade: false } } } as StudioAccount;
    render(<MemoryRouter><StudioPendingBilling account={account} /></MemoryRouter>);
    expect(screen.getByRole('status').textContent).toContain('Starter starts');
    expect(screen.getByRole('status').textContent).toContain('current plan and credit remain available');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('links an owned request to local client review without creating payment', () => {
    const account = { ...fixture.account, pendingBilling: { count: 1, requests: [billingRequest] } } as StudioAccount;
    render(<MemoryRouter><StudioPendingBilling account={account} /></MemoryRouter>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/listing-studio/payment-requests/' + billingRequest.id);
    expect(screen.getByRole('link').textContent).toContain('Review request');
  });
});
