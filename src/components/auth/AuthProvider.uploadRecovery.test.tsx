import '@testing-library/jest-dom/vitest';
import { useEffect } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';
import { protectUploadFromNavigation, releaseUploadNavigationProtection } from '@/lib/uploadNavigationProtection';
import { trackTelemetryBlocker } from '@/features/system-overview/telemetryClient';

vi.mock('@/features/system-overview/telemetryClient', () => ({ trackTelemetryBlocker: vi.fn() }));

const user = { id: '989', role: 'photographer', email: 'photographer@example.test', name: 'QA photographer' };
const mount = vi.fn();
const unmount = vi.fn();
function RetainedQueue() {
  const auth = useAuth();
  useEffect(() => { mount(); return unmount; }, []);
  return <div data-testid="retained-queue">{auth.isLoading ? 'Loading' : `Selected files for ${auth.user?.id}`}</div>;
}

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('authToken', 'qa-token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
});
afterEach(() => {
  cleanup(); releaseUploadNavigationProtection('auth-qa');
  vi.unstubAllGlobals(); vi.clearAllMocks();
});
async function showQueue() {
  render(<AuthProvider><RetainedQueue /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('retained-queue')).toHaveTextContent('Selected files for 989'));
}

describe('auth changes during uploads', () => {
  it('aborts on another account and keeps the selected-file tree mounted behind a blocking dialog', async () => {
    await showQueue();
    const abort = vi.fn();
    act(() => protectUploadFromNavigation('auth-qa', abort));
    localStorage.setItem('user', JSON.stringify({ ...user, id: '990' }));
    fireEvent(window, new StorageEvent('storage', { key: 'user', storageArea: localStorage }));
    expect(abort).toHaveBeenCalledOnce();
    expect(trackTelemetryBlocker).toHaveBeenCalledWith('upload_auth_changed', expect.any(String), { source: 'auth_session_sync' });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Your sign-in changed');
    expect(screen.getByTestId('retained-queue')).toHaveTextContent('Selected files for 989');
    expect(mount).toHaveBeenCalledOnce();
    expect(unmount).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Stopping uploads…' })).toBeDisabled();
    act(() => releaseUploadNavigationProtection('auth-qa'));
    expect(screen.getByRole('button', { name: 'Reload to continue' })).toBeEnabled();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    fireEvent.focus(window);
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(unmount).not.toHaveBeenCalled();
  });

  it('detects removal of the token using the in-memory session instead of treating both sides as guest', async () => {
    await showQueue();
    const abort = vi.fn();
    act(() => protectUploadFromNavigation('auth-qa', abort));
    localStorage.removeItem('authToken');
    fireEvent.focus(window);
    expect(abort).toHaveBeenCalledOnce();
    expect(screen.getByRole('alertdialog')).toBeVisible();
  });

  it('does not interrupt unchanged identity, a profile update, or a same-account token refresh', async () => {
    await showQueue();
    const abort = vi.fn();
    act(() => protectUploadFromNavigation('auth-qa', abort));
    fireEvent.focus(window);
    localStorage.setItem('user', JSON.stringify({ ...user, name: 'Updated name' }));
    localStorage.setItem('authToken', 'refreshed-qa-token');
    fireEvent(window, new StorageEvent('storage', { key: 'authToken', storageArea: localStorage }));
    fireEvent.focus(window);
    expect(abort).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('retained-queue')).toHaveTextContent('Selected files for 989');
  });

  it('discards an old profile refresh after another tab changes the account during upload', async () => {
    let resolveProfile!: (response: { ok: boolean; status: number; json: () => Promise<typeof user> }) => void;
    let refreshSignal!: AbortSignal;
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => {
      refreshSignal = init.signal as AbortSignal;
      // Deliberately ignore abort: the epoch must reject a late old-account
      // response even when cancellation cannot stop it from resolving.
      return new Promise((resolve) => { resolveProfile = resolve; });
    }));
    await showQueue();
    const abort = vi.fn();
    act(() => protectUploadFromNavigation('auth-qa', abort));
    const nextUser = { ...user, id: '990' };
    localStorage.setItem('user', JSON.stringify(nextUser));
    localStorage.setItem('authToken', 'next-account-token');
    fireEvent(window, new StorageEvent('storage', { key: 'user', storageArea: localStorage }));
    expect(refreshSignal.aborted).toBe(true);
    expect(abort).toHaveBeenCalledOnce();
    await act(async () => {
      resolveProfile({ ok: true, status: 200, json: async () => user });
    });
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(nextUser);
    expect(localStorage.getItem('authToken')).toBe('next-account-token');
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(screen.getByTestId('retained-queue')).toHaveTextContent('Selected files for 989');
  });
});
