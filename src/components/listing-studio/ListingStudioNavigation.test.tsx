import React from 'react';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { SidebarLinks } from '@/components/layout/sidebar/SidebarLinks';
import { useMobileMenu } from '@/components/layout/mobile-menu/useMobileMenu';
import { canReviewListingStudio, canUseListingStudio, canUseListingStudioDashboard, listingStudioHref, listingStudioRole } from '@/utils/listingStudio';
import { LISTING_STUDIO_WEBSITE_URL } from '@/config/listingStudio';
import { MenuItem } from '@/components/layout/mobile-menu/MenuItem';

const auth = vi.hoisted(() => ({ role: 'client', user: { secondary_roles: [] as string[] }, logout: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ isLoading: false, can: () => true, forResource: () => ({ canView: () => true }) }) }));
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
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe('Listing Studio navigation', () => {
  it.each(['client', 'salesRep', 'admin', 'superadmin'])('places the desktop entry immediately after Exclusive Listings for %s', role => {
    auth.role = role;
    render(<SidebarLinks role={role} isCollapsed={false} />, { wrapper });
    const links = screen.getAllByRole('link');
    const exclusiveIndex = links.indexOf(screen.getByRole('link', { name: 'Exclusive Listings' }));
    expect(links[exclusiveIndex + 1]).toHaveTextContent('Listing Studio');
    expect(links[exclusiveIndex + 1]).toHaveAttribute('href', role === 'client' ? LISTING_STUDIO_WEBSITE_URL : '/portal?view=grid&listingStudio=1#saved');
    if (role === 'client') {
      expect(links[exclusiveIndex + 1]).toHaveAttribute('target', '_blank');
      expect(links[exclusiveIndex + 1]).toHaveAttribute('rel', 'noopener noreferrer');
    } else {
      expect(links[exclusiveIndex + 1]).not.toHaveAttribute('target', '_blank');
    }
  });

  it.each(['client', 'salesRep', 'admin', 'superadmin'])('places the mobile entry immediately after Exclusive Listings for %s', role => {
    auth.role = role;
    const { result } = renderHook(useMobileMenu, { wrapper });
    const items = result.current.filteredItems;
    const exclusiveIndex = items.findIndex(item => item.label === 'Exclusive Listings');
    const item = items[exclusiveIndex + 1];
    expect(item).toMatchObject({ label: 'Listing Studio', to: role === 'client' ? LISTING_STUDIO_WEBSITE_URL : '/portal?view=grid&listingStudio=1#saved' });
    expect(Boolean(item.external)).toBe(role === 'client');
    render(<MenuItem {...item} onClick={vi.fn()} />, { wrapper });
    const link = screen.getByRole('link', { name: 'Listing Studio' });
    expect(link).toHaveAttribute('href', item.to);
    if (role === 'client') {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
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
    expect(listingStudioHref({ pathname: '/dashboard', search: '?listingStudio=1', hash: '' }, 'admin')).toBe('/dashboard?listingStudio=1');
    expect(listingStudioHref({ pathname: '/dashboard', search: '?listingStudio=1&listingStudioTab=requests', hash: '' }, 'client')).toBe(LISTING_STUDIO_WEBSITE_URL);
  });

  it('keeps staff signup available to a primary client with a secondary rep role', () => {
    auth.user.secondary_roles = ['sales_rep'];
    render(<SidebarLinks role="client" isCollapsed={false} />, { wrapper });
    const link = screen.getByRole('link', { name: 'Listing Studio' });
    expect(link).toHaveAttribute('href', '/portal?view=grid&listingStudio=1#saved');
    expect(link).not.toHaveAttribute('target', '_blank');
    const { result } = renderHook(useMobileMenu, { wrapper });
    const item = result.current.filteredItems.find(item => item.label === 'Listing Studio');
    expect(item?.to).toBe('/portal?view=grid&listingStudio=1#saved');
    expect(item?.external).toBeFalsy();
  });
});
