import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { StudioDropboxConnectionPanel } from './StudioDropboxConnectionPanel';
import DropboxCallback from '@/components/DropboxCallback';
import { disconnectStudioDropbox, readStudioDropboxStatus, startStudioDropboxConnection } from '@/services/studioDropbox';

const context = vi.hoisted(() => ({ role: 'admin', isImpersonating: false, toast: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => context }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: context.toast }) }));
vi.mock('@/services/studioDropbox', () => ({
  readStudioDropboxStatus: vi.fn(), startStudioDropboxConnection: vi.fn(), disconnectStudioDropbox: vi.fn(),
}));

const connected = {
  connected: true, configured: true, enabled: true, storage_mode: 'dropbox',
  account_label: 'Studio Dropbox account', connection_version: 'v1', revocation_pending: false,
};
function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
function renderPanel(path = '/settings?tab=integrations') {
  return render(<MemoryRouter initialEntries={[path]}><StudioDropboxConnectionPanel /><Location /></MemoryRouter>);
}

describe('studio Dropbox administrator panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.role = 'admin';
    context.isImpersonating = false;
    localStorage.clear();
    vi.mocked(readStudioDropboxStatus).mockResolvedValue(connected);
  });
  afterEach(cleanup);

  it.each(['editing_manager', 'editor', 'photographer', 'salesRep', 'client'])('does not expose studio management to %s', async (role) => {
    context.role = role;
    renderPanel();
    expect(screen.queryByRole('button', { name: /Connect Dropbox/i })).not.toBeInTheDocument();
    expect(readStudioDropboxStatus).not.toHaveBeenCalled();
    expect(startStudioDropboxConnection).not.toHaveBeenCalled();
  });

  it('does not allow connection management during impersonation', () => {
    context.isImpersonating = true;
    renderPanel();
    expect(screen.getByText(/Return to your administrator account/)).toBeInTheDocument();
    expect(readStudioDropboxStatus).not.toHaveBeenCalled();
  });

  it('uses the visible connection version and refreshes after disconnect', async () => {
    vi.mocked(disconnectStudioDropbox).mockResolvedValue(true);
    renderPanel();
    const button = await screen.findByRole('button', { name: 'Disconnect Dropbox' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(disconnectStudioDropbox).toHaveBeenCalledWith('v1'));
    await waitFor(() => expect(readStudioDropboxStatus).toHaveBeenCalledTimes(2));
    expect(context.toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('revocation is pending') }));
  });

  it('refreshes a stale connection without retrying the disconnect', async () => {
    vi.mocked(disconnectStudioDropbox).mockRejectedValue({ response: { status: 409 } });
    renderPanel();
    const button = await screen.findByRole('button', { name: 'Disconnect Dropbox' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('connection changed');
    expect(disconnectStudioDropbox).toHaveBeenCalledTimes(1);
    expect(readStudioDropboxStatus).toHaveBeenCalledTimes(2);
  });

  it.each(['r2', 'r2_only'])('allows retrying pending revocation without reconnecting and reports %s storage accurately', async (storageMode) => {
    vi.mocked(readStudioDropboxStatus).mockResolvedValue({ ...connected, connected: false, enabled: false, storage_mode: storageMode, revocation_pending: true });
    vi.mocked(disconnectStudioDropbox).mockResolvedValue(false);
    renderPanel();
    const retry = await screen.findByRole('button', { name: 'Retry disconnect' });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Connect Dropbox' })).toBeDisabled();
    expect(screen.getByText('Storage: Cloudflare R2')).toBeInTheDocument();
    expect(screen.queryByText('Storage: Local server')).not.toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(disconnectStudioDropbox).toHaveBeenCalledWith('v1'));
    expect(startStudioDropboxConnection).not.toHaveBeenCalled();
  });

  it('never displays raw provider errors from failed initiation', async () => {
    vi.mocked(startStudioDropboxConnection).mockRejectedValue(new Error('provider access_token=secret'));
    renderPanel();
    const button = await screen.findByRole('button', { name: 'Reconnect Dropbox' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be started');
    expect(screen.queryByText(/access_token/)).not.toBeInTheDocument();
  });

  it('uses server status after callback and removes the status parameter and old browser token', async () => {
    localStorage.setItem('dropbox_access_token', 'legacy');
    vi.mocked(readStudioDropboxStatus).mockResolvedValue({ ...connected, connected: false });
    renderPanel('/settings?tab=integrations&dropbox=connected');
    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/settings?tab=integrations');
    expect(screen.getByTestId('location')).not.toHaveTextContent('dropbox=');
    expect(localStorage.getItem('dropbox_access_token')).toBeNull();
    expect(context.toast).toHaveBeenCalledTimes(1);
  });

  it('retires the old browser callback without exchanging or forwarding tokens', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<MemoryRouter initialEntries={['/dropbox-callback?code=untrusted']}><DropboxCallback /><Location /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/integrations?dropbox=error'));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
