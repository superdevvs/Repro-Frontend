import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardLayout } from './DashboardLayout';
import { usePageLoading } from '@/hooks/use-page-loading';

vi.mock('./Sidebar', () => ({ Sidebar: () => <nav><a href="/dashboard">Dashboard</a></nav> }));
vi.mock('./Navbar', () => ({ Navbar: () => <header><button>Navigation</button></header> }));
vi.mock('./MobileMenu', () => ({ default: () => null }));
vi.mock('./PageTransition', () => ({ PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-media-query', () => ({ useMediaQuery: () => false }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: 'admin', user: { id: 1 }, stopImpersonating: vi.fn() }) }));
vi.mock('@/components/auth/EmailVerificationNotice', () => ({ EmailVerificationNotice: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

function Page({ loading }: { loading: boolean }) {
  usePageLoading(loading);
  return <DashboardLayout><button>Page action</button></DashboardLayout>;
}

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
});
