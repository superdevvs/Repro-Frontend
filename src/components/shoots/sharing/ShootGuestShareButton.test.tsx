import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootGuestShareButton } from './ShootGuestShareButton';

const auth = vi.hoisted(() => ({ role: 'client', user: { id: '12', role: 'superadmin' } }));
vi.mock('@/components/auth', () => ({ useAuth: () => auth }));
vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ Authorization: 'Bearer actor', 'X-Impersonate-User-Id': '12', 'Content-Type': 'application/json' }) }));
const shoot = { id: '42', client: { id: '12' } } as ShootData;
beforeEach(() => { auth.role = 'client'; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Magic Link sharing', () => {
  it('honors the effective role and requires the client to own the shoot', () => {
    render(<ShootGuestShareButton shoot={{ ...shoot, client: { id: '99' } } as ShootData} />);
    expect(screen.queryByRole('button', { name: 'Share shoot' })).not.toBeInTheDocument();
  });

  it('uses canonical impersonation headers when sending the requested Magic Link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ShootGuestShareButton shoot={shoot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share shoot' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Recipient email'), { target: { value: 'guest@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));
    await screen.findByText('Magic Link sent to guest@example.com.');
    const post = fetchMock.mock.calls.find(([, options]) => options.method === 'POST');
    expect(post?.[1]).toMatchObject({ credentials: 'include', headers: { Authorization: 'Bearer actor', 'X-Impersonate-User-Id': '12' }, body: JSON.stringify({ email: 'guest@example.com' }) });
  });

  it('clears the dialog and cancels requests when the viewed shoot changes', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<ShootGuestShareButton shoot={shoot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Share shoot' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    rerender(<ShootGuestShareButton shoot={{ ...shoot, id: '43' }} />);
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
