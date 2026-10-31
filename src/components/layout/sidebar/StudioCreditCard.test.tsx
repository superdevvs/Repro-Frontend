import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import fixture from '@/components/listing-studio/client/studioFixtures.test-data.json';
import { StudioCreditCard } from './StudioCreditCard';

const state = vi.hoisted(() => ({
  auth: { user: { id: 42, role: 'client', isActive: true, secondary_roles: [] as string[] }, isAuthenticated: true, isLoading: false, isImpersonating: false },
  query: { data: undefined as unknown, isError: false, isPending: false, isFetching: false, refetch: vi.fn() },
  account: vi.fn(),
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('@/hooks/useStudioAccount', () => ({ useStudioAccount: (id?: string) => { state.account(id); return state.query; } }));
const show = (path = '/dashboard', collapsed = false) => render(<MemoryRouter initialEntries={[path]}><TooltipProvider><StudioCreditCard isCollapsed={collapsed} /></TooltipProvider></MemoryRouter>);

beforeEach(() => {
  state.auth = { user: { id: 42, role: 'client', isActive: true, secondary_roles: [] }, isAuthenticated: true, isLoading: false, isImpersonating: false };
  state.query = { data: { ...fixture.account, credits: { ...fixture.account.credits, availableCents: 12550, reservedCents: 1500 }, subscription: { planCode: 'pro' } }, isError: false, isPending: false, isFetching: false, refetch: vi.fn() };
  state.account.mockClear();
});
afterEach(cleanup);

describe('persistent Studio credit', () => {
  it('uses the server available amount and opens the editing billing page', () => {
    show();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/listing-studio?tab=billing');
    expect(screen.getByText('$125.50')).toBeTruthy();
    expect(screen.getByText('$15 reserved')).toBeTruthy();
    expect(screen.getByText(/Pro/)).toBeTruthy();
  });
  it('exposes the exact balance and destination when collapsed', () => {
    show('/dashboard', true);
    expect(screen.getByRole('link', { name: /\$125.50 editing credit available, \$15 reserved/ })).toBeTruthy();
  });
  it.each(['canceled', 'incomplete_expired'])('offers plans when only a historical %s subscription remains', status => {
    state.query.data = { ...fixture.account, subscription: { planCode: 'pro', status } };
    show();
    expect(screen.getByText('View plans')).toBeTruthy();
    expect(screen.queryByText(/^Pro/)).toBeNull();
  });
  it('never renders a fabricated zero while loading or on failure', () => {
    state.query.data = undefined; state.query.isPending = true;
    const view = show();
    expect(screen.getByRole('status').textContent).toBe('Loading balance…');
    expect(screen.queryByText('$0')).toBeNull();
    state.query.isPending = false; state.query.isError = true;
    view.rerender(<MemoryRouter><TooltipProvider><StudioCreditCard /></TooltipProvider></MemoryRouter>);
    expect(screen.getByText('Balance unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry editing credit balance' }));
    expect(state.query.refetch).toHaveBeenCalledOnce();
  });
  it.each(['admin', 'editor', 'photographer'])('does not expose financial access for %s or its secondary client role', role => {
    state.auth.user.role = role; state.auth.user.secondary_roles = ['client'];
    show();
    expect(screen.queryByRole('link')).toBeNull();
    expect(state.account).not.toHaveBeenCalled();
  });
  it('retains own-client credit when a client has a secondary staff role', () => {
    state.auth.user.secondary_roles = ['admin']; show();
    expect(screen.getByText('$125.50')).toBeTruthy();
  });
  it('hides all financial data during impersonation', () => {
    state.auth.isImpersonating = true; show();
    expect(screen.queryByRole('link')).toBeNull();
    expect(state.account).not.toHaveBeenCalled();
  });
  it('does not expose a cached balance for an inactive account', () => {
    state.auth.user.isActive = false; show();
    expect(screen.queryByRole('link')).toBeNull();
    expect(state.account).not.toHaveBeenCalled();
  });
  it.each(['salesRep', 'rep', 'superadmin', 'admin', 'editing_manager', 'editingManager'].flatMap(role =>
    ['/dashboard', '/listing-studio/manage/81?tab=billing'].flatMap(path => [false, true].map(collapsed => ({ role, path, collapsed }))),
  ))('hides staff credit and launcher for $role on $path (collapsed=$collapsed)', ({ role, path, collapsed }) => {
    state.auth.user.role = role;
    state.query.data = { ...(state.query.data as object), client: { id: '81', name: 'Jane Client', email: 'jane@example.test' }, management: { canPurchase: true, canManageSubscription: false } };
    const view = show(path, collapsed);
    expect(view.container.textContent).toBe('');
    expect(screen.queryByRole('link')).toBeNull();
    expect(state.account).not.toHaveBeenCalled();
  });
  it('always reads the primary client own balance, regardless of a managed route parameter', () => {
    show('/listing-studio/manage/81?tab=billing');
    expect(state.account).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/listing-studio?tab=billing');
  });
});
