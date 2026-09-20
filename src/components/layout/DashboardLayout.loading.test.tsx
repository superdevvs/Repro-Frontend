import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
import { usePageLoading } from '@/hooks/use-page-loading';

vi.mock('./Sidebar', () => ({ Sidebar: () => <nav><a href="/dashboard">Dashboard</a></nav> }));
vi.mock('./Navbar', () => ({ Navbar: () => <header><button>Navigation</button></header> }));
const viewport = vi.hoisted(() => ({ mobile: false, compact: false, bottomNavHeight: 62 }));
vi.mock('./MobileMenu', () => ({
  default: function MockMobileMenu({ onBottomNavHeightChange }: { onBottomNavHeightChange?: (height: number) => void }) {
    const bottomNavHeight = viewport.bottomNavHeight;
    React.useLayoutEffect(() => {
      onBottomNavHeightChange?.(bottomNavHeight);
    }, [onBottomNavHeightChange, bottomNavHeight]);
    return <nav aria-label="Mobile navigation"><button>Mobile menu</button></nav>;
  },
}));
vi.mock('./PageTransition', () => ({ PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.mobile }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => viewport.compact }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin', user: { id: 1 }, stopImpersonating: vi.fn() }) }));
vi.mock('@/components/auth/EmailVerificationNotice', () => ({ EmailVerificationNotice: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function Page({ loading }: { loading: boolean }) {
  usePageLoading(loading);
  return <DashboardLayout><button>Page action</button></DashboardLayout>;
}

beforeEach(() => { viewport.mobile = false; viewport.compact = false; viewport.bottomNavHeight = 62; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('dashboard page loading integration', () => {
  it('uses one overlay for nested layouts and leaves navigation usable while the page loads', () => {
    vi.useFakeTimers();
    const view = (loading: boolean) => <MemoryRouter initialEntries={['/shoot-history']}><DashboardLayout><Page loading={loading} /></DashboardLayout></MemoryRouter>;
    const { rerender, container } = render(view(true));
    expect(container.querySelectorAll('[data-page-loading]')).toHaveLength(1);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Navigation' }).closest('[inert]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' }).closest('[inert]')).toBeNull();
    expect(screen.getByText('Page action').closest('[inert]')).not.toBeNull();
    rerender(view(false));
    act(() => { vi.advanceTimersByTime(151); });
    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();
  });

  it('centers above the measured mobile navigation and follows its height changes', () => {
    viewport.mobile = true;
    const view = () => <MemoryRouter initialEntries={['/shoot-history']}><DashboardLayout><Page loading /></DashboardLayout></MemoryRouter>;
    const { rerender } = render(view());
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveStyle({ paddingBottom: '62px' });
    expect(screen.getByRole('button', { name: 'Mobile menu' }).closest('[inert]')).toBeNull();

    viewport.bottomNavHeight = 88;
    rerender(view());
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveStyle({ paddingBottom: '88px' });
  });

  it('removes the mobile inset when resizing into the desktop shell', () => {
    viewport.mobile = true;
    const view = () => <MemoryRouter initialEntries={['/shoot-history']}><DashboardLayout><Page loading /></DashboardLayout></MemoryRouter>;
    const { rerender } = render(view());
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveStyle({ paddingBottom: '62px' });

    viewport.mobile = false;
    rerender(view());
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveStyle({ paddingBottom: '0px' });
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('accounts for navigation on the compact tablet dashboard as well', () => {
    viewport.compact = true;
    viewport.bottomNavHeight = 70;
    render(<MemoryRouter initialEntries={['/dashboard']}><DashboardLayout><Page loading /></DashboardLayout></MemoryRouter>);
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveStyle({ paddingBottom: '70px' });
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('ends compact dashboard content just above the measured bottom nav on every device height', () => {
    viewport.mobile = true;
    viewport.bottomNavHeight = 88;
    const view = () => (
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardLayout>
          <button>Page action</button>
        </DashboardLayout>
      </MemoryRouter>
    );
    const { container, rerender } = render(view());
    expect(container.querySelector('main')).toHaveStyle({ paddingBottom: '88px' });

    viewport.bottomNavHeight = 55;
    rerender(view());
    expect(container.querySelector('main')).toHaveStyle({ paddingBottom: '55px' });
  });

  it('hides the footer on the compact dashboard so tab panels can use the remaining viewport', () => {
    viewport.mobile = true;
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardLayout>
          <button>Page action</button>
        </DashboardLayout>
      </MemoryRouter>,
    );
    expect(container.querySelector('footer')).toBeNull();
    expect(screen.queryByText(/Terms and Conditions/)).not.toBeInTheDocument();
    expect(container.querySelector('main')?.className).toMatch(/overflow-hidden/);
    expect(container.querySelector('main')?.className).toMatch(/flex-col/);
  });

  it('keeps the footer on compact pages that are not the dashboard', () => {
    viewport.mobile = true;
    const { container } = render(
      <MemoryRouter initialEntries={['/shoot-history']}>
        <DashboardLayout>
          <button>Page action</button>
        </DashboardLayout>
      </MemoryRouter>,
    );
    expect(container.querySelector('footer')).not.toBeNull();
    expect(screen.getByText(/Terms and Conditions/)).toBeInTheDocument();
  });
});
