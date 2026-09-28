import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Navbar } from './Navbar';

const auth = vi.hoisted(() => ({
  user: { id: '1', name: 'Pat Photographer', role: 'photographer' as string, secondary_roles: [] as string[] },
  role: 'photographer' as string,
  logout: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ user: auth.user, role: auth.role, logout: auth.logout }),
}));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ can: () => false, isLoading: false }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  auth.user.secondary_roles = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('photographer and editor account menu', () => {
  it.each(['photographer', 'editor'])('keeps only Settings for %s', async (role) => {
    auth.role = role;
    auth.user = { id: '1', name: role === 'editor' ? 'Ed Editor' : 'Pat Photographer', role, secondary_roles: [] };
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Profile' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Listing Studio' })).not.toBeInTheDocument();
  });

  it.each(['photographer', 'editor'])('offers Listing Studio for %s with an eligible secondary role', (role) => {
    auth.role = role;
    auth.user = { id: '1', name: 'Staff member', role, secondary_roles: ['sales_rep'] };
    render(<MemoryRouter><Navbar /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Listing Studio' })).toBeInTheDocument();
  });
});
