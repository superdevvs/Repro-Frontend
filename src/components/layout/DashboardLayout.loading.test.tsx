import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
import { usePageLoading } from '@/hooks/use-page-loading';
import { LISTING_STUDIO_WEBSITE_URL } from '@/config/listingStudio';

vi.mock('./Sidebar', () => ({ Sidebar: () => <nav><a href="/dashboard">Dashboard</a></nav> }));
vi.mock('./Navbar', () => ({ Navbar: () => <header><button>Navigation</button></header> }));
const viewport = vi.hoisted(() => ({ mobile: false, compact: false, tall: true, availabilityDesktop: false, bottomNavHeight: 62 }));
const auth = vi.hoisted(() => ({ role: 'admin', user: { id: 1, secondary_roles: [] as string[] }, stopImpersonating: vi.fn() }));
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
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/components/auth/EmailVerificationNotice', () => ({ EmailVerificationNotice: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/listing-studio/ListingStudioDialog', () => ({ default: ({ initialTab }: { initialTab?: string }) => <div role="dialog" aria-label="Listing Studio" data-initial-tab={initialTab}>Staff requests</div> }));

function Page({ loading }: { loading: boolean }) {
  usePageLoading(loading);
  return <DashboardLayout><button>Page action</button></DashboardLayout>;
}

beforeEach(() => { viewport.mobile = false; viewport.compact = false; viewport.tall = true; viewport.availabilityDesktop = false; viewport.bottomNavHeight = 62; auth.role = 'admin'; auth.user.secondary_roles = []; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('dashboard page loading integration', () => {
  it.each([['desktop', '/calls/inbox'], ['phone', '/calls/inbox'], ['desktop', '/messaging/email/inbox?tab=support'], ['phone', '/messaging/email/inbox?tab=support']])('keeps the original dashboard navigation on %s %s', (surface, path) => {
    viewport.mobile = surface === 'phone';
    const { container } = render(<MemoryRouter initialEntries={[path]}><DashboardLayout><DashboardLayout hideFooter><button>Conversations</button></DashboardLayout></DashboardLayout></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Navigation' })).toBeInTheDocument();
    if (viewport.mobile) {
      expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
      expect(container.querySelector('main')).toHaveStyle({ paddingBottom: '62px' });
    } else {
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
      expect(container.querySelector('main')).toHaveClass('p-3');
    }
    expect(container.querySelector('main')).toHaveClass('overflow-hidden');
    expect(container.querySelector('footer')).toBeNull();
  });

  it.each(['/dashboard?listingStudio=1', '/dashboard?listingStudio=1&listingStudioTab=requests', '/dashboard?listingStudio=1&listingStudioTab=subscriptions'])('redirects a client legacy link to the website without opening a form: %s', path => {
    auth.role = 'client';
    const replace = vi.fn();
    // Stub only this test's window reference; do not redefine jsdom's Location.
    const actualWindow = window;
    vi.stubGlobal('window', new Proxy(actualWindow, {
      get: (target, property) => property === 'location' ? { replace } : Reflect.get(target, property, target),
    }));
    render(<MemoryRouter initialEntries={[path]}><DashboardLayout><button>Page action</button></DashboardLayout></MemoryRouter>);
    expect(replace).toHaveBeenCalledWith(LISTING_STUDIO_WEBSITE_URL);
    expect(screen.queryByRole('dialog', { name: 'Listing Studio' })).not.toBeInTheDocument();
  });

  it.each(['salesRep', 'admin', 'superadmin'])('preserves the staff request dialog and notification tab for %s', async role => {
    auth.role = role;
    render(<MemoryRouter initialEntries={['/dashboard?listingStudio=1&listingStudioTab=requests']}><DashboardLayout><button>Page action</button></DashboardLayout></MemoryRouter>);
    expect(await screen.findByRole('dialog', { name: 'Listing Studio' })).toHaveAttribute('data-initial-tab', 'requests');
  });

  it.each(['salesRep', 'admin', 'superadmin'])('opens subscription notification links for %s', async role => {
    auth.role = role;
    render(<MemoryRouter initialEntries={['/dashboard?listingStudio=1&listingStudioTab=subscriptions']}><DashboardLayout><button>Page action</button></DashboardLayout></MemoryRouter>);
    expect(await screen.findByRole('dialog', { name: 'Listing Studio' })).toHaveAttribute('data-initial-tab', 'subscriptions');
  });

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

  it('keeps nested page content and navigation usable during section loading', () => {
    vi.useFakeTimers();
    const view = (loading: boolean) => <MemoryRouter initialEntries={['/shoot-history']}><DashboardLayout><Page loading={loading} /></DashboardLayout></MemoryRouter>;
    const { rerender, container } = render(view(true));
    expect(container.querySelectorAll('[data-page-loading]')).toHaveLength(1);
    expect(container.querySelectorAll('main')).toHaveLength(1);
    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Navigation' }).closest('[inert]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' }).closest('[inert]')).toBeNull();
    expect(screen.getByText('Page action').closest('[inert]')).toBeNull();
    rerender(view(false));
    act(() => { vi.advanceTimersByTime(151); });
    expect(screen.queryByRole('status', { name: 'Loading page' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();
  });

  it('keeps content usable when the mobile navigation height changes', () => {
    viewport.mobile = true;
    const view = () => <MemoryRouter initialEntries={['/shoot-history']}><DashboardLayout><Page loading /></DashboardLayout></MemoryRouter>;
    const { rerender } = render(view());
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Mobile menu' }).closest('[inert]')).toBeNull();

    viewport.bottomNavHeight = 88;
    rerender(view());
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();
  });

  it('keeps content usable when resizing into the desktop shell', () => {
    viewport.mobile = true;
    const view = () => <MemoryRouter initialEntries={['/shoot-history']}><DashboardLayout><Page loading /></DashboardLayout></MemoryRouter>;
    const { rerender } = render(view());
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();

    viewport.mobile = false;
    rerender(view());
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('accounts for navigation on the compact tablet dashboard as well', () => {
    viewport.compact = true;
    viewport.bottomNavHeight = 70;
    render(<MemoryRouter initialEntries={['/dashboard']}><DashboardLayout><Page loading /></DashboardLayout></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Page action' })).toBeEnabled();
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
