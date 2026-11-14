import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GuestShootOverview from './GuestShootOverview';

const unverified = { verified: false, recipient: 'g***@example.com', data: null };
const overview = { property: { address: '1211 Ripple Court', city: 'Pasadena', state: 'MD', zip: '21122', beds: 3, baths: 2, sqft: 1748 }, services: [], files: [], tours: [], expires_at: '2026-12-14T00:00:00Z' };
function SwitchInvitation() { const navigate = useNavigate(); return <button onClick={() => navigate('/guest/shoot/second')}>Next invitation</button>; }
function show() { return render(<MemoryRouter initialEntries={['/guest/shoot/first']}><SwitchInvitation /><Routes><Route path="/guest/shoot/:token" element={<GuestShootOverview />} /></Routes></MemoryRouter>); }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('guest Magic Link overview', () => {
  it('closes a preview when refreshed access no longer includes the file', async () => {
    const file = { id: 1, kind: 'photo', name: 'Front.jpg', preview_url: '/api/public/guest-shares/first/files/1', download_url: '/api/public/guest-shares/first/files/1?download=1' };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ ...unverified, verified: true, data: { ...overview, files: [file] } }))
      .mockResolvedValue(Response.json({ ...unverified, verified: true, data: overview }));
    vi.stubGlobal('fetch', fetchMock); show();
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Front.jpg' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('link', { name: 'Download Front.jpg' })).not.toBeInTheDocument();
  });

  it('requires email verification before rendering property content', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(unverified))
      .mockResolvedValueOnce(Response.json({ message: 'Code sent' }))
      .mockResolvedValueOnce(Response.json({ message: 'Verified' }))
      .mockResolvedValueOnce(Response.json({ ...unverified, verified: true, data: overview }));
    vi.stubGlobal('fetch', fetchMock); show();
    fireEvent.click(await screen.findByRole('button', { name: 'Email me a verification code' }));
    expect(screen.queryByText('1211 Ripple Court')).not.toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText('Six-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'View property' }));
    await screen.findByText('1211 Ripple Court');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ credentials: 'include', method: 'POST', body: JSON.stringify({ code: '123456' }) });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('aborts an old verification and resets code entry when another Magic Link opens', async () => {
    let finishVerification!: (value: Response) => void;
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(unverified))
      .mockResolvedValueOnce(Response.json({}))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finishVerification = resolve; }))
      .mockResolvedValue(Response.json({ ...unverified, recipient: 'n***@example.com' }));
    vi.stubGlobal('fetch', fetchMock); show();
    fireEvent.click(await screen.findByRole('button', { name: 'Email me a verification code' }));
    fireEvent.change(await screen.findByLabelText('Six-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'View property' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const signal = fetchMock.mock.calls[2][1].signal as AbortSignal;
    fireEvent.click(screen.getByRole('button', { name: 'Next invitation' }));
    await screen.findByText(/Verify n\*\*\*@example.com/);
    expect(signal.aborted).toBe(true);
    expect(screen.queryByLabelText('Six-digit code')).not.toBeInTheDocument();
    await act(async () => { finishVerification(Response.json({})); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.queryByText('1211 Ripple Court')).not.toBeInTheDocument();
  });
});
