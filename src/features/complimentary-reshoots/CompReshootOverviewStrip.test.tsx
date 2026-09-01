import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ShootData } from '@/types/shoots';

const { getShootCompensations } = vi.hoisted(() => ({
  getShootCompensations: vi.fn(),
}));

vi.mock('./api', () => ({ getShootCompensations }));

import { CompReshootOverviewStrip } from './CompReshootOverviewStrip';

const shoot = (values: Partial<ShootData>): ShootData => ({
  id: '91',
  status: 'scheduled',
  shootType: 'complimentary_reshoot',
  ...values,
} as ShootData);

describe('CompReshootOverviewStrip', () => {
  beforeEach(() => getShootCompensations.mockReset());
  afterEach(cleanup);

  it('loads and displays a photographer own amount and payout status', async () => {
    getShootCompensations.mockResolvedValue({
      photographer_compensations: [{
        recipient_type: 'photographer',
        amount: 75,
        payout_status: 'eligible',
      }],
    });

    render(<CompReshootOverviewStrip shoot={shoot({})} role="photographer" onOpenShoot={vi.fn()} />);

    expect(screen.getByText('Your payout loading…')).toBeInTheDocument();
    expect(await screen.findByText('Your payout $75.00 · Eligible')).toBeInTheDocument();
    expect(getShootCompensations).toHaveBeenCalledWith('91');
  });

  it('never invents a zero amount when the role-filtered response has no row', async () => {
    getShootCompensations.mockResolvedValue({ compensations: [] });

    render(<CompReshootOverviewStrip shoot={shoot({})} role="salesRep" onOpenShoot={vi.fn()} />);

    expect(await screen.findByText('Your compensation unavailable')).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('shows zero only when an audited None row explicitly returns zero', async () => {
    getShootCompensations.mockResolvedValue({
      sales_rep_compensation: { amount: 0, payout_status: 'not_applicable' },
    });

    render(<CompReshootOverviewStrip shoot={shoot({})} role="salesRep" onOpenShoot={vi.fn()} />);

    expect(await screen.findByText('Your compensation $0.00 · Not Applicable')).toBeInTheDocument();
  });

  it('shows clients only safe related-shoot context on an original shoot', () => {
    render(<CompReshootOverviewStrip
      shoot={shoot({
        shootType: 'standard',
        reshootChildren: [{
          id: '92',
          address: '10 Main Street',
          scheduledAt: '2026-09-12T14:00:00Z',
          status: 'scheduled',
          reasonCode: 'missed_area',
          affectedServiceNames: ['Photography'],
        }],
      })}
      role="client"
      onOpenShoot={vi.fn()}
    />);

    expect(screen.getByText('Related shoots (1)')).toBeInTheDocument();
    expect(screen.getByText('10 Main Street')).toBeInTheDocument();
    expect(screen.getByText(/Photography · Scheduled/)).toBeInTheDocument();
    expect(screen.queryByText('Missed area')).not.toBeInTheDocument();
    expect(screen.queryByText(/Staff|payout|compensation|\$/i)).not.toBeInTheDocument();
    expect(getShootCompensations).not.toHaveBeenCalled();
  });
});
