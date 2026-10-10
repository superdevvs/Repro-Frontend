import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingAiUsage } from './AccountingAiUsage';
import { AccountingHeader } from './AccountingHeader';
import type { AccountingAiUsage as Usage } from '@/services/accountingAiUsageService';

const mocks = vi.hoisted(() => ({ role: 'superadmin', fetch: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: '1' }, role: mocks.role }) }));
vi.mock('@/services/api', () => ({ getImpersonatedUserId: () => null }));
vi.mock('@/services/accountingAiUsageService', () => ({ fetchAccountingAiUsage: (...args: unknown[]) => mocks.fetch(...args) }));
const empty = { metered_calls: 0, historical_calls: 0, failed_calls: 0, unconfirmed_calls: 0, input_tokens: 0, cached_tokens: 0, output_tokens: 0, unknown_token_calls: 0, estimated_cost_usd: null, unpriced_calls: 0 };
const fixture: Usage = {
  start: '2026-10-01', end: '2026-10-10', timezone: 'UTC', currency: 'USD',
  summary: { ...empty, historical_calls: 177, unknown_token_calls: 177, unpriced_calls: 177 },
  daily: [{ ...empty, date: '2026-10-01', historical_calls: 62, unknown_token_calls: 62, unpriced_calls: 62 }],
  features: [{ ...empty, feature: 'photo_classification', label: 'Photo classification', historical_calls: 172 }],
  models: [{ ...empty, model: 'gpt-4o', historical_calls: 177 }],
  metering_enabled: true, first_metered_call_at: null, pricing_version: '2026-10-10',
  scope_note: 'RePro calls only.', cost_note: 'Estimated USD, not an invoice.', history_note: 'Historical counts are reconstructed minimums.',
};
function mount(start = '2026-10-01', end = '2026-10-10') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<AccountingAiUsage start={start} end={end} />, { wrapper });
}
beforeEach(() => { mocks.role = 'superadmin'; mocks.fetch.mockReset().mockResolvedValue(fixture); });
afterEach(cleanup);

describe('superadmin Accounting AI usage', () => {
  it('shows historical minimums and unavailable cost instead of zero spend', async () => {
    mount();
    await screen.findByRole('region', { name: 'Daily OpenAI usage' });
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(1);
    expect(screen.queryByText('$0.0000')).toBeNull();
    expect(screen.getByText('0 metered · 177 historical minimum')).toBeTruthy();
    expect(screen.getByText('Photo classification')).toBeTruthy();
    expect(mocks.fetch.mock.calls[0].slice(0, 2)).toEqual(['2026-10-01', '2026-10-10']);
  });
  it('refetches with the changed Accounting date range', async () => {
    const view = mount();
    await screen.findByRole('region', { name: 'Daily OpenAI usage' });
    view.rerender(<AccountingAiUsage start="2026-10-06" end="2026-10-06" />);
    await waitFor(() => expect(mocks.fetch.mock.calls.some(args => args[0] === '2026-10-06' && args[1] === '2026-10-06')).toBe(true));
  });
  it('does not request or display usage for an admin', async () => {
    mocks.role = 'admin';
    const view = mount();
    await Promise.resolve();
    expect(view.container.textContent).toBe('');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('shows an error and retry action when the request fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('Unavailable'));
    mount();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
  it('only offers the AI usage section when explicitly enabled', () => {
    const props = { onCreateInvoice: vi.fn(), onTabChange: vi.fn(), showTabs: true };
    const view = render(<AccountingHeader {...props} />);
    expect(screen.queryByRole('button', { name: 'AI usage' })).toBeNull();
    view.rerender(<AccountingHeader {...props} showAiUsage />);
    expect(screen.getByRole('button', { name: 'AI usage' })).toBeTruthy();
  });
});
