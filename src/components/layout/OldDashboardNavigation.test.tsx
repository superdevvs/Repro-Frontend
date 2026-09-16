import React from 'react';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Navbar } from './Navbar';
import { MenuContent } from './mobile-menu/MenuContent';
import { useMobileMenu } from './mobile-menu/useMobileMenu';

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Admin User', role: 'admin' },
    role: 'admin',
    logout: vi.fn(),
  }),
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ can: () => false, isLoading: false }),
}));
vi.mock('@/hooks/useLinkedSharedVisibility', () => ({
  useLinkedSharedVisibility: () => ({ data: { hasLinkedAccounts: false } }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));
vi.mock('@/contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({ formatTemperature: () => '--°' }),
}));
vi.mock('@/components/notifications/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));
vi.mock('@/components/search/GlobalCommandBar', () => ({
  GlobalCommandBar: () => null,
}));
vi.mock('@/components/ai/RobbieInsightStrip', () => ({
  RobbieInsightStrip: () => null,
}));
vi.mock('@/services/weatherService', () => ({
  getWeatherByCoordinates: vi.fn(() => new Promise(() => undefined)),
}));
vi.mock('@/state/weatherProviderStore', () => ({
  subscribeToWeatherProvider: () => () => undefined,
}));
vi.mock('@/config/env', () => ({
  withApiBase: (path: string) => path,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Old Dashboard responsive navigation', () => {
  it('does not render the Old Dashboard link in the top navbar', () => {
    render(<Navbar />, { wrapper });

    expect(screen.queryByRole('link', { name: /Old Dashboard/i })).not.toBeInTheDocument();
  });

  it('renders the Old Dashboard as an external link in the mobile menu drawer', () => {
    const { result } = renderHook(() => useMobileMenu(), { wrapper });

    render(
      <MenuContent
        isMenuOpen
        filteredItems={result.current.filteredItems}
        closeMenu={vi.fn()}
        handleLogout={vi.fn()}
      />,
      { wrapper },
    );

    const oldDashboardLink = screen.getByRole('link', { name: 'Old Dashboard' });
    expect(oldDashboardLink).toHaveAttribute('href', 'https://reprophotos.viewshoot.com');
    expect(oldDashboardLink).toHaveAttribute('target', '_blank');
    expect(oldDashboardLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
