import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/vitest';
import CopilotConnect from './CopilotConnect';
import CopilotConnections from './CopilotConnections';

vi.mock('@/components/auth', () => ({ useAuth: () => ({ isImpersonating: false }) }));
vi.mock('@/utils/authToken', () => ({ getStoredAuthToken: () => 'dashboard-token' }));
const requestId = '11111111-1111-4111-8111-111111111111';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Copilot account connection', () => {
  it('shows the exact account and requested scopes before any approval', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ request_id: requestId, client_name: 'ChatGPT',
      account: { name: 'Client Owner', email: 'owner@example.com' }, scopes: ['repro.read', 'repro.write'], expires_at: '2026-10-09T12:00:00Z' }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={[`/copilot/connect?request_id=${requestId}`]}><CopilotConnect /></MemoryRouter>);
    expect(await screen.findByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow connection' })).toBeEnabled();
    expect(screen.getByText(/confirmed actions may send configured notifications/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer dashboard-token');
  });

  it('rejects a malicious OAuth return URL after approval', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ request_id: requestId, client_name: 'ChatGPT', account: { name: 'Owner', email: 'owner@example.com' }, scopes: ['repro.read'] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ redirect_url: 'https://evil.example/steal' })));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={[`/copilot/connect?request_id=${requestId}`]}><CopilotConnect /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Allow connection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid connection destination.');
    expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({ approve: true }));
  });

  it('explains an expired request without an approval button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'This connection request has expired.' }), { status: 410 })));
    render(<MemoryRouter initialEntries={[`/copilot/connect?request_id=${requestId}`]}><CopilotConnect /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(screen.queryByRole('button', { name: 'Allow connection' })).not.toBeInTheDocument();
  });

  it('revokes only the selected connection and updates the list after success', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [
      { id: requestId, name: 'ChatGPT work', scopes: 'repro.read repro.write', created_at: '2026-10-09T12:00:00Z' },
    ] }))).mockResolvedValueOnce(new Response(JSON.stringify({ disconnected: true })));
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><CopilotConnections /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke access' }));
    expect(await screen.findByText(/No active connections/)).toBeInTheDocument();
    expect(fetch.mock.calls[1][0]).toContain(requestId);
    expect(fetch.mock.calls[1][1].method).toBe('DELETE');
  });
});
