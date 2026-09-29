import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
import { usePageLoading } from '@/hooks/use-page-loading';

vi.mock('./Sidebar', () => ({ Sidebar: () => <nav><a href="/dashboard">Dashboard</a></nav> }));
vi.mock('./Navbar', () => ({ Navbar: () => <header><button>Navigation</button></header> }));
const viewport = vi.hoisted(() => ({ mobile: false, compact: false, tall: true, availabilityDesktop: false, bottomNavHeight: 62 }));
vi.mock('./MobileMenu', () => ({
  default: function MockMobileMenu({ onBottomNavHeightChange }: { onBottomNavHeightChange?: (height: number) => void }) {
    const bottomNavHeight = viewport.bottomNavHeight;
    React.useLayoutEffect(() => {
      onBottomNavHeightChange?.(bottomNavHeight);
    }, [onBottomNavHeightChange, bottomNavHeight]);
    return <nav aria-label="Mobile navigation"><button>Mobile menu</button></nav>;
  },
}));
vi.mock('./PageTransition', () => ({ PageTransition: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.mobile }));
vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: (query: string) => {
    if (query.includes('min-height')) return viewport.tall && !viewport.mobile;
    if (query.includes('min-width: 1280')) return viewport.availabilityDesktop;
    return viewport.compact;
  },
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin', user: { id: 1 }, stopImpersonating: vi.fn() }) }));
vi.mock('@/components/auth/EmailVerificationNotice', () => ({ EmailVerificationNotice: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function Page({ loading }: { loading: boolean }) {
  usePageLoading(loading);
  return <DashboardLayout><button>Page action</button></DashboardLayout>;
}

beforeEach(() => { viewport.mobile = false; viewport.compact = false; viewport.tall = true; viewport.availabilityDesktop = false; viewport.bottomNavHeight = 62; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('dashboard page loading integration', () => {
  it.each(['/messaging/email/automations/21', '/messaging/email/automations/new'])('contains workflow editor scroll at %s', (path) => {
    const { container } = render(<MemoryRouter initialEntries={[path]}><DashboardLayout><button>Editor</button></DashboardLayout></MemoryRouter>);
    expect(container.querySelector('main')).toHaveClass('overflow-hidden');
    expect(container.querySelector('footer')).toBeNull();
  });

  it.each(['/messaging/email/automations', '/availability', '/shoot-history'])('keeps ordinary page scrolling at %s', (path) => {
    const { container } = render(<MemoryRouter initialEntries={[path]}><DashboardLayout><button>Page action</button></DashboardLayout></MemoryRouter>);
    expect(container.querySelector('main')).toHaveClass('overflow-y-auto');
    expect(container.querySelector('footer')).not.toBeNull();
  });

  it('keeps DashboardLayout mounted across Dashboard → Availability without a hooks crash', () => {
    // Regression: fillDesktopCalendar used to call useMediaQuery only on
    // /availability|/shoot-history, so navigating from Dashboard added a hook
    // and ErrorBoundary showed "This view could not load".
    vi.useFakeTimers();
    viewport.availabilityDesktop = true;
    function Jump() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate('/availability')}>View full schedule</button>;
    }
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardLayout>
          <Routes>
            <Route path="/dashboard" element={<Jump />} />
            <Route path="/availability" element={<button type="button">Availability page</button>} />
          </Routes>
        </DashboardLayout>
      </MemoryRouter>,
    );
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByRole('button', { name: 'View full schedule' })).toBeInTheDocument();
    expect(screen.queryByText('This view could not load')).not.toBeInTheDocument();
    act(() => {
      screen.getByRole('button', { name: 'View full schedule' }).click();
    });
    // PageLoadingBoundary remounts on pathname change; uncover before asserting role queries.
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText('Availability page')).toBeInTheDocument();
    expect(screen.queryByText('This view could not load')).not.toBeInTheDocument();
    expect(container.querySelector('main')).toHaveClass('overflow-hidden');
  });

  it.each(['/availability', '/shoot-history'])('locks %s desktop main scroll, fills the flex chain, and hides footer', (path) => {
    viewport.availabilityDesktop = true;
    const { container } = render(<MemoryRouter initialEntries={[path]}><DashboardLayout><button>Page action</button></DashboardLayout></MemoryRouter>);
    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-hidden');
    expect(main).toHaveClass('flex');
    expect(container.querySelector('footer')).toBeNull();
  });

  it.each(['phone', 'short desktop'])('keeps workflow content scrollable on a %s', (surface) => {
    viewport.mobile = surface === 'phone';
    viewport.tall = false;
    const { container } = render(<MemoryRouter initialEntries={['/messaging/email/automations/21']}><DashboardLayout><button>Editor</button></DashboardLayout></MemoryRouter>);
    expect(container.querySelector('main')).toHaveClass('overflow-y-auto');
    expect(container.querySelector('footer')).toBeNull();
  });

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
    const main = container.querySelector('main');
    // The filled dashboard page ignores main padding on phones, so the inset
    // is a CSS variable consumed by .dashboard-mobile-page, not main padding.
    expect(main).not.toHaveStyle({ paddingBottom: '88px' });
    expect(main).toHaveAttribute('style', expect.stringContaining('--mobile-bottom-nav-height: 88px'));

    viewport.bottomNavHeight = 55;
    rerender(view());
    expect(container.querySelector('main')).toHaveAttribute(
      'style',
      expect.stringContaining('--mobile-bottom-nav-height: 55px'),
    );
  });

  it('does not stretch the compact dashboard page to 100% of main, which ignores bottom-nav padding on phones', () => {
    viewport.mobile = true;
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardLayout>
          <button>Page action</button>
        </DashboardLayout>
      </MemoryRouter>,
    );
    const lock = container.querySelector('main > div > div');
    expect(lock?.className).toMatch(/flex-1/);
    expect(lock?.className).toMatch(/min-w-0/);
    expect(lock?.className).not.toMatch(/\bh-full\b/);
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
