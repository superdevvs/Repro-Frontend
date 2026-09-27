import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { SalesRepSummarySection } from './SalesRepSummarySection';
import type { SalesRepSummaryResponse } from '@/types/salesSummary';

vi.mock('recharts', () => ({ ResponsiveContainer: () => null, ComposedChart: () => null, CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Bar: () => null, Line: () => null }));
afterEach(cleanup);
const data: SalesRepSummaryResponse = {
  period: { start_date: '2026-09-01', end_date: '2026-09-27', days_window: 27 },
  summary: { paid_revenue: 600, new_clients: 1, average_client_value: 100, commission_earned: null, commission_rate: null }, trend: [],
  top_clients: Array.from({ length: 6 }, (_, index) => ({ client_id: index + 1, client_name: `Account ${index + 1}`, paid_revenue: 100, outstanding_balance: index === 1 ? 50 : 0, last_shoot_date: '2026-09-20' })),
  new_clients: [{ client_id: 10, client_name: 'Newest client', paid_revenue: 0, outstanding_balance: 20, last_shoot_date: null, created_at: '2026-09-12' }],
};
describe('Sales client workspace', () => {
  it('keeps the new-client list, account balances, details, and pagination accessible', async () => {
    render(<SalesRepSummarySection data={data} loading={false} error={null} daysWindow={27} onRetry={vi.fn()} />);
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.queryByText('Account 6')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next client page' }));
    await userEvent.click(screen.getByRole('button', { name: 'View Account 6' }));
    expect(within(screen.getByRole('dialog')).getByText('Account 6')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Client list' }), 'new');
    expect(screen.getByText('Newest client')).toBeInTheDocument();
    expect(screen.getByText('Sep 12, 2026')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Client list' }), 'balance');
    expect(screen.getByText('Account 2')).toBeInTheDocument();
    expect(screen.getByText('Newest client')).toBeInTheDocument();
    expect(screen.queryByText('Account 1')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search clients' }), 'missing');
    expect(screen.getByText('No clients match your search.')).toBeInTheDocument();
  });
});
