import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';
import { DashboardInstallBanner } from '@/components/dashboard/DashboardInstallBanner';

vi.mock('@/hooks/useDashboardInstall', () => ({ useDashboardInstall: () => ({
  installed: false, mobile: true, ios: true, prompt: vi.fn(),
}) }));
vi.mock('@/features/system-overview/telemetryClient', () => ({ trackTelemetryBlocker: vi.fn() }));
const user = { id: '999', name: 'Local client', email: 'client@example.test', role: 'client' as const };

function LoginProbe() {
  const auth = useAuth();
  return <>
    <button disabled={auth.isLoading} onClick={() => auth.login(user, 'fixture-token')}>Test login</button>
    <button onClick={auth.logout}>Test logout</button>
    <DashboardInstallBanner />
  </>;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('starts the suggestion only on login and clears it on logout', async () => {
  render(<AuthProvider><LoginProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('Test login')).toBeEnabled());
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Test login'));
  expect(screen.getByRole('complementary')).toBeVisible();
  fireEvent.click(screen.getByText('Test logout'));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});

it('does not restart the suggestion when restoring a saved authenticated session', async () => {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('authToken', 'fixture-token');
  render(<AuthProvider><LoginProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByText('Test login')).toBeEnabled());
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});
