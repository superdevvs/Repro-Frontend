import React from 'react';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { SidebarLinks } from '@/components/layout/sidebar/SidebarLinks';
import { useMobileMenu } from '@/components/layout/mobile-menu/useMobileMenu';
import { canReviewListingStudio, canUseListingStudio, canUseListingStudioDashboard, listingStudioHref, listingStudioRole } from '@/utils/listingStudio';
import { LISTING_STUDIO_CLIENT_PATH, LISTING_STUDIO_WEBSITE_URL } from '@/config/listingStudio';
import { MenuItem } from '@/components/layout/mobile-menu/MenuItem';

const auth = vi.hoisted(() => ({
  role: 'client',
  user: { secondary_roles: [] as string[], isActive: true },
  isImpersonating: false,
  logout: vi.fn(),
}));
const deniedPermissions = vi.hoisted(() => new Set<string>());
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    isLoading: false,
    can: (resource: string) => !deniedPermissions.has(resource),
    forResource: () => ({ canView: () => true }),
  }),
}));
vi.mock('@/hooks/useLinkedSharedVisibility', () => ({ useLinkedSharedVisibility: () => ({ data: { hasLinkedAccounts: false }, loading: false }) }));
let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={['/portal?view=grid#saved']}>{children}</MemoryRouter>
  </QueryClientProvider>
);
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  auth.role = 'client';
  auth.user.secondary_roles = [];
  auth.user.isActive = true;
  auth.isImpersonating = false;
  deniedPermissions.clear();
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe('Listing Studio navigation', () => {
  it.each(['salesRep', 'rep', 'representative', 'superadmin', 'admin'])('opens the pricing workspace for primary %s without a legacy modal query', role => {
    expect(listingStudioHref({ pathname: '/dashboard', search: '?listingStudio=1&listingStudioTab=requests', hash: '#saved' }, role)).toBe('/listing-studio/manage');
  });
  it('keeps the standalone entry active on a selected client workspace without AI Editing access', () => {
    auth.role = 'superadmin';
    deniedPermissions.add('ai-editing');
    const managedWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/listing-studio/manage/42?tab=billing']}>{children}</MemoryRouter></QueryClientProvider>;
    render(<SidebarLinks role="superadmin" isCollapsed={false} />, { wrapper: managedWrapper });
    expect(screen.getByRole('link', { name: 'Listing Studio' })).toHaveAttribute('data-sidebar-active', 'true');
    const { result } = renderHook(useMobileMenu, { wrapper: managedWrapper });
    expect(result.current.filteredItems.find(item => item.label === 'Listing Studio')?.isActive).toBe(true);
  });

  it.each(['admin', 'superadmin', 'salesRep'])('shows AI Editing as the active destination for Listing Studio for %s', role => {
    auth.role = role;
    const aiEditingWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/ai-editing?section=listing-studio']}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    render(<SidebarLinks role={role} isCollapsed={false} />, { wrapper: aiEditingWrapper });
    expect(screen.queryByRole('link', { name: 'Listing Studio' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Editing' })).toHaveAttribute('data-sidebar-active', 'true');

    const { result } = renderHook(useMobileMenu, { wrapper: aiEditingWrapper });
    expect(result.current.filteredItems.some(item => item.label === 'Listing Studio')).toBe(false);
    expect(result.current.filteredItems.find(item => item.label === 'AI Editing')?.isActive).toBe(true);
  });

  it.each(['admin', 'superadmin', 'editing_manager', 'editor'])('keeps revisions out of desktop and mobile menus for %s', role => {
    auth.role = role;
    render(<SidebarLinks role={role} isCollapsed={false} />, { wrapper });
    expect(screen.queryByRole('link', { name: 'Studio revisions' })).not.toBeInTheDocument();
    const { result } = renderHook(useMobileMenu, { wrapper });
    expect(result.current.filteredItems.some(item => item.to === '/listing-studio/revisions')).toBe(false);
  });
  it.each(['client', 'salesRep', 'admin', 'superadmin'])('places the standalone desktop entry immediately after Exclusive Listings for %s', role => {
    auth.role = role;
    deniedPermissions.add('ai-editing');
    render(<SidebarLinks role={role} isCollapsed={false} />, { wrapper });
    const links = screen.getAllByRole('link');
    const exclusiveIndex = links.indexOf(screen.getByRole('link', { name: 'Exclusive Listings' }));
    expect(links[exclusiveIndex + 1]).toHaveTextContent('Listing Studio');
    expect(links[exclusiveIndex + 1]).toHaveAttribute('href', role === 'client' ? LISTING_STUDIO_CLIENT_PATH : '/listing-studio/manage');
    expect(links[exclusiveIndex + 1]).not.toHaveAttribute('target', '_blank');
  });

  it.each(['client', 'salesRep', 'admin', 'superadmin'])('places the standalone mobile entry immediately after Exclusive Listings for %s', role => {
    auth.role = role;
    deniedPermissions.add('ai-editing');
    const { result } = renderHook(useMobileMenu, { wrapper });
    const items = result.current.filteredItems;
    const exclusiveIndex = items.findIndex(item => item.label === 'Exclusive Listings');
    const item = items[exclusiveIndex + 1];
    expect(item).toMatchObject({ label: 'Listing Studio', to: role === 'client' ? LISTING_STUDIO_CLIENT_PATH : '/listing-studio/manage' });
    expect(Boolean(item.external)).toBe(false);
    render(<MenuItem {...item} onClick={vi.fn()} />, { wrapper });
    const link = screen.getByRole('link', { name: 'Listing Studio' });
    expect(link).toHaveAttribute('href', item.to);
    expect(link).not.toHaveAttribute('target', '_blank');
  });

  it('keeps the existing Listing Studio shortcut for an editing manager with secondary staff access', () => {
    auth.role = 'editing_manager';
    auth.user.secondary_roles = ['sales_rep'];
    const legacyHref = '/portal?view=grid&listingStudio=1#saved';
    render(<SidebarLinks role={auth.role} isCollapsed={false} />, { wrapper });
    expect(screen.getByRole('link', { name: 'Listing Studio' })).toHaveAttribute('href', legacyHref);
    const { result } = renderHook(useMobileMenu, { wrapper });
    expect(result.current.filteredItems.find(item => item.label === 'Listing Studio')?.to).toBe(legacyHref);
  });

  it.each([
    ['inactive', { isActive: false, isImpersonating: false }],
    ['impersonated', { isActive: true, isImpersonating: true }],
  ] as const)('does not apply the AI Editing move to an %s session', (_name, state) => {
    auth.role = 'superadmin';
    auth.user.isActive = state.isActive;
    auth.isImpersonating = state.isImpersonating;
    render(<SidebarLinks role={auth.role} isCollapsed={false} />, { wrapper });
    expect(screen.getByRole('link', { name: 'Listing Studio' })).toHaveAttribute('href', '/listing-studio/manage');
    const { result } = renderHook(useMobileMenu, { wrapper });
    expect(result.current.filteredItems.find(item => item.label === 'Listing Studio')?.to).toBe('/listing-studio/manage');
  });

  it.each(['photographer', 'editor', 'editing_manager'])('hides both entries for %s', role => {
    auth.role = role;
    render(<SidebarLinks role={role} isCollapsed={false} />, { wrapper });
    expect(screen.queryByRole('link', { name: 'Listing Studio' })).not.toBeInTheDocument();
    const { result } = renderHook(useMobileMenu, { wrapper });
    expect(result.current.filteredItems.some(item => item.label === 'Listing Studio')).toBe(false);
  });

  it('uses the same secondary-role precedence as the API', () => {
    expect(listingStudioRole('client', ['sales_rep', 'admin'])).toBe('admin');
    expect(listingStudioRole('salesRep', ['super_admin'])).toBe('superadmin');
    expect(canReviewListingStudio('client', ['admin'])).toBe(true);
    expect(canReviewListingStudio('client', ['sales_rep'])).toBe(false);
    expect(canUseListingStudio('editor', ['sales_rep'])).toBe(true);
    expect(canUseListingStudioDashboard('client')).toBe(false);
    expect(canUseListingStudioDashboard('editor', ['client'])).toBe(false);
    expect(canUseListingStudioDashboard('client', ['sales_rep'])).toBe(true);
    expect(listingStudioHref({ pathname: '/dashboard', search: '?listingStudio=1', hash: '' }, 'admin')).toBe('/listing-studio/manage');
    expect(listingStudioHref({ pathname: '/dashboard', search: '?listingStudio=1&listingStudioTab=requests', hash: '' }, 'client')).toBe(LISTING_STUDIO_CLIENT_PATH);
    expect(listingStudioHref({ pathname: '/dashboard', search: '', hash: '' }, 'editor', ['client'])).toBe(LISTING_STUDIO_WEBSITE_URL);
  });

  it.each(['sales_rep', 'admin', 'superadmin'])('keeps primary client navigation on its own workspace with secondary %s', secondaryRole => {
    auth.user.secondary_roles = [secondaryRole];
    render(<SidebarLinks role="client" isCollapsed={false} />, { wrapper });
    const link = screen.getByRole('link', { name: 'Listing Studio' });
    expect(link).toHaveAttribute('href', LISTING_STUDIO_CLIENT_PATH);
    expect(link).not.toHaveAttribute('target', '_blank');
    const { result } = renderHook(useMobileMenu, { wrapper });
    const item = result.current.filteredItems.find(item => item.label === 'Listing Studio');
    expect(item?.to).toBe(LISTING_STUDIO_CLIENT_PATH);
    expect(item?.external).toBeFalsy();
  });
});

describe('Scheduling navigation', () => {
  it.each(['admin', 'superadmin', 'editing_manager'])('exposes standalone Scheduling for %s only when Settings is unavailable', role => {
    auth.role = role;
    const desktop = render(<SidebarLinks role={role} isCollapsed={false} />, { wrapper });
    const mobile = renderHook(useMobileMenu, { wrapper });
    expect(screen.queryByRole('link', { name: 'Scheduling' })).not.toBeInTheDocument();
    expect(mobile.result.current.filteredItems.some(item => item.label === 'Scheduling')).toBe(false);
    expect(mobile.result.current.filteredItems.find(item => item.label === 'Settings')?.to).toBe('/settings');

    deniedPermissions.add('settings');
    desktop.rerender(<SidebarLinks role={role} isCollapsed={false} />);
    mobile.rerender();
    expect(screen.getByRole('link', { name: 'Scheduling' })).toHaveAttribute('href', '/scheduling-settings');
    expect(mobile.result.current.filteredItems.find(item => item.label === 'Scheduling')?.to).toBe('/scheduling-settings');
  });

  it.each([
    ['admin', ['settings', 'scheduling-settings']],
    ['client', ['settings']],
  ] as const)('keeps standalone Scheduling hidden when %s cannot use it', (role, denied) => {
    auth.role = role;
    denied.forEach(resource => deniedPermissions.add(resource));
    render(<SidebarLinks role={role} isCollapsed={false} />, { wrapper });
    const { result } = renderHook(useMobileMenu, { wrapper });
    expect(screen.queryByRole('link', { name: 'Scheduling' })).not.toBeInTheDocument();
    expect(result.current.filteredItems.some(item => item.label === 'Scheduling')).toBe(false);
  });
});
