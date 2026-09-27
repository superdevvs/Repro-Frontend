import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { ShootData } from '@/types/shoots';
import { PhotographerEarningsOverview } from './PhotographerEarningsOverview';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '7', name: 'Our Photographer' } }) }));
vi.mock('recharts', () => ({ ResponsiveContainer: () => null, ComposedChart: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Area: () => null, Bar: () => null, Line: () => null }));
afterEach(cleanup);
const shoot = (id: number, date: string, owner = '7') => ({
  id: String(id), photographer: { id: owner, name: owner === '7' ? 'Our Photographer' : 'Other Photographer' },
  status: 'completed', completedDate: date, location: { address: `Property ${id}`, city: 'City' },
  totalPhotographerPay: 100, photographer_paid_at: id === 1 ? '2026-09-21T12:00:00Z' : null,
} as unknown as ShootData);
describe('Photographer earnings period', () => {
  it('filters ownership and completion dates and paginates the full recent list', async () => {
    const shoots = [...Array.from({ length: 6 }, (_, i) => shoot(i + 1, `2026-09-${20 + i}T12:00:00Z`)), shoot(20, '2026-09-20T12:00:00Z', '99'), shoot(21, '2026-08-20T12:00:00Z')];
    const { rerender } = render(<PhotographerEarningsOverview shoots={shoots} dateRange={{ startDate: '2026-09-01', endDate: '2026-09-27' }} />);
    expect(screen.queryByText('Property 20')).not.toBeInTheDocument();
    expect(screen.queryByText('Property 21')).not.toBeInTheDocument();
    expect(screen.queryByText('Property 1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next earnings page' }));
    expect(screen.getByText('Property 1')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Photographer earnings summary' });
    expect(within(summary).getByText('6')).toBeInTheDocument();
    expect(within(summary).getByText('$600.00')).toBeInTheDocument();
    expect(within(summary).getByText('$500.00')).toBeInTheDocument();
    rerender(<PhotographerEarningsOverview shoots={shoots} dateRange={{ startDate: '2026-08-01', endDate: '2026-08-31' }} />);
    expect(screen.getByText('Property 21')).toBeInTheDocument();
    expect(screen.queryByText('Property 1')).not.toBeInTheDocument();
  });
});
