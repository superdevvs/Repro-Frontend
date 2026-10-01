import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Index from '@/pages/Index';
import { LoginRedirect } from './LoginRedirect';

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  login: vi.fn(),
  post: vi.fn(),
}));
vi.mock('@/components/auth', () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated, login: mocks.login }),
}));
vi.mock('axios', () => ({ default: { post: mocks.post, isAxiosError: () => false } }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/layout/Logo', () => ({ Logo: () => <span>REPro</span> }));
vi.mock('./RegisterForm', () => ({ default: () => null }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>;
}

function DashboardDestination() {
  return mocks.isAuthenticated ? <div>Photographer dashboard</div> : <LoginRedirect />;
}

function mountAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/dashboard" element={<DashboardDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function submitCredentials() {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'photographer@example.test' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Example-password-42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
}

const loginResponse = { data: {
  token: 'test-token',
  user: { id: 42, name: 'QA Photographer', email: 'photographer@example.test', role: 'photographer' },
} };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAuthenticated = false;
  mocks.post.mockReset();
  mocks.login.mockImplementation(() => { mocks.isAuthenticated = true; });
});
afterEach(cleanup);

describe('upload guide sign-in return flow', () => {
  it('takes an email deep link through login and back to its guide query', async () => {
    mocks.post.mockResolvedValueOnce(loginResponse);
    mountAt('/dashboard?guide=uploads');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Log in to your dashboard' })).toBeVisible());
    expect(screen.queryByText('Photographer dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/?returnTo=%2Fdashboard%3Fguide%3Duploads');
    submitCredentials();
    expect(await screen.findByText('Photographer dashboard')).toBeVisible();
    expect(screen.getByTestId('location').textContent).toBe('/dashboard?guide=uploads');
  });

  it('retains the guide after refreshing login and completing the authenticator challenge', async () => {
    mocks.post.mockResolvedValueOnce({ data: { two_factor_required: true } }).mockResolvedValueOnce(loginResponse);
    const firstPage = mountAt('/dashboard?guide=uploads');
    await screen.findByRole('heading', { name: 'Log in to your dashboard' });
    const loginUrl = screen.getByTestId('location').textContent!;
    firstPage.unmount();
    mountAt(loginUrl);
    submitCredentials();
    const code = await screen.findByLabelText('Authenticator or recovery code');
    expect(mocks.login).not.toHaveBeenCalled();
    expect(screen.getByTestId('location').textContent).toBe(loginUrl);
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify & Log In' }));
    expect(await screen.findByText('Photographer dashboard')).toBeVisible();
    expect(screen.getByTestId('location').textContent).toBe('/dashboard?guide=uploads');
    expect(mocks.post).toHaveBeenLastCalledWith(expect.stringMatching(/\/api\/login$/), expect.objectContaining({ two_factor_code: '123456' }));
  });

  it('uses the same destination when the login page already has an authenticated session', async () => {
    mocks.isAuthenticated = true;
    mountAt('/?returnTo=%2Fdashboard%3Fguide%3Duploads');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/dashboard?guide=uploads'));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['/', '/?returnTo=https%3A%2F%2Fattacker.example', '/?returnTo=%2F%2Fattacker.example'])(
    'keeps a successful login inside the dashboard for %s', async (path) => {
      mocks.post.mockResolvedValueOnce(loginResponse);
      mountAt(path);
      submitCredentials();
      expect(await screen.findByText('Photographer dashboard')).toBeVisible();
      expect(screen.getByTestId('location').textContent).toBe('/dashboard');
    },
  );
});
