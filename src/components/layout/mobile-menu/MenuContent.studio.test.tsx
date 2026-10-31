import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/components/listing-studio/client/studioFixtures.test-data.json';
import { MenuContent } from './MenuContent';

const state = vi.hoisted(() => ({
  auth: { user: { id: 42, role: 'client', isActive: true, secondary_roles: [] as string[] }, isAuthenticated: true, isLoading: false, isImpersonating: false },
  account: vi.fn(),
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => state.auth }));
vi.mock('@/hooks/useMessagingBadgeCounts', () => ({ useMessagingBadgeCounts: () => ({ email: 0, sms: 0, call: 0 }) }));
vi.mock('@/hooks/useStudioAccount', () => ({ useStudioAccount: () => state.account() }));

const closeMenu = vi.fn();
const show = (path = '/dashboard') => render(<MemoryRouter initialEntries={[path]}>
  <MenuContent isMenuOpen filteredItems={[]} closeMenu={closeMenu} handleLogout={vi.fn()} />
</MemoryRouter>);

beforeEach(() => {
  state.auth = { user: { id: 42, role: 'client', isActive: true, secondary_roles: [] }, isAuthenticated: true, isLoading: false, isImpersonating: false };
  state.account.mockReset().mockReturnValue({ data: fixture.account, isError: false, isPending: false, isFetching: false, refetch: vi.fn() });
  closeMenu.mockClear();
});
afterEach(cleanup);

describe('mobile More client-only editing credit', () => {
  it('shows the client own balance and closes More on billing navigation', () => {
    show();
    const link = screen.getByRole('link', { name: /editing credit available/ });
    expect(link.getAttribute('href')).toBe('/listing-studio?tab=billing');
    fireEvent.click(link);
    expect(closeMenu).toHaveBeenCalledOnce();
    expect(state.account).toHaveBeenCalled();
  });
  it.each(['superadmin', 'admin', 'editing_manager', 'editingManager', 'salesRep', 'rep'].flatMap(role =>
    ['/dashboard', '/listing-studio/manage/81?tab=billing'].map(path => ({ role, path })),
  ))('omits both staff launcher and selected-client balance for $role on $path', ({ role, path }) => {
    state.auth.user.role = role;
    state.auth.user.secondary_roles = ['client'];
    show(path);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Client plans & credit')).toBeNull();
    expect(screen.queryByLabelText('Editing credit')).toBeNull();
    expect(state.account).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
  });
  it('does not show credit while impersonating a client', () => {
    state.auth.isImpersonating = true;
    show();
    expect(screen.queryByRole('link')).toBeNull();
    expect(state.account).not.toHaveBeenCalled();
  });
});
