import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShootData } from '@/types/shoots';
import { ShootSharingDialog } from './ShootSharingDialog';
import type { GuestInvitation } from './guestShareTypes';

vi.mock('@/services/api', () => ({ getApiHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer actor', 'X-Impersonate-User-Id': '12' }) }));
const shoot = { id: '42', location: { address: 'Example property' } } as ShootData;
const invitation = (id: number, email: string): GuestInvitation => ({ id, email, status: 'active', created_at: '2026-11-14T12:00:00Z', expires_at: '2099-12-14T12:00:00Z', revoked_at: null, last_verified_at: null, can_copy: true, can_resend: true, creator: { id: 1, name: 'Office' } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const openDialog = async () => {
  render(<ShootSharingDialog shoot={shoot} />);
  fireEvent.click(screen.getByRole('button', { name: 'Share shoot' }));
  await screen.findByRole('dialog');
};

describe('Sharing multiple recipients and managing access', () => {
  it('validates all recipients before sending and retries only failed emails', async () => {
    const first = invitation(1, 'one@example.com');
    const second = invitation(2, 'two@example.com');
    let submissions = 0;
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        submissions += 1;
        return Response.json({ data: submissions === 1
          ? [{ email: first.email, outcome: 'sent', share: first }, { email: second.email, outcome: 'failed', message: 'Try again.' }]
          : [{ email: second.email, outcome: 'sent', share: second }] });
      }
      return Response.json({ data: submissions ? [first, second] : [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: 'ONE@example.com, one@example.com, invalid' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Links/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check this email address: invalid');
    expect(submissions).toBe(0);
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: 'ONE@example.com, one@example.com, two@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Magic Links/ }));
    await screen.findByText(/1 could not be sent/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send Magic Link · 1' })).toBeEnabled());
    expect(fetchMock.mock.calls.find(([, options]) => options.method === 'POST')?.[1].body).toBe(JSON.stringify({ emails: [first.email, second.email] }));
    expect(fetchMock.mock.calls.find(([, options]) => options.method === 'POST')?.[1]).toMatchObject({ credentials: 'include', headers: { Authorization: 'Bearer actor', 'X-Impersonate-User-Id': '12' } });
    expect(screen.queryByRole('button', { name: `Remove ${first.email}` })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Remove ${second.email}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send Magic Link · 1' }));
    await waitFor(() => expect(submissions).toBe(2));
    expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')[1][1].body).toBe(JSON.stringify({ emails: [second.email] }));
  });

  it('copies only the authorized personal link and revokes after explicit confirmation', async () => {
    let active = invitation(5, 'guest@example.com');
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/link')) return Response.json({ data: { url: 'https://example.com/guest/shoot/personal-link' } });
      if (options.method === 'DELETE') { active = { ...active, status: 'revoked', revoked_at: new Date().toISOString(), can_copy: false }; return Response.json({}); }
      return Response.json({ data: [active] });
    });
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Manage access/ }), { button: 0, ctrlKey: false });
    const row = await screen.findByRole('article', { name: 'Access for guest@example.com' });
    fireEvent.click(within(row).getByRole('button', { name: 'Copy link for guest@example.com' }));
    await waitFor(() => expect(clipboard).toHaveBeenCalledWith('https://example.com/guest/shoot/personal-link'));
    expect(await within(row).findByText('Copied')).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Revoke access for guest@example.com' }));
    expect(fetchMock.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(false);
    fireEvent.click(within(row).getByRole('button', { name: /^Revoke$/ }));
    await screen.findByText('Access revoked for guest@example.com.');
    expect(within(row).getByRole('button', { name: 'Copy link for guest@example.com' })).toBeDisabled();
    expect(within(row).getByText('Revoked')).toBeInTheDocument();
  });

  it('retains only failed recipients when sending succeeds but the access list cannot refresh', async () => {
    const sent = invitation(1, 'sent@example.com');
    const failed = invitation(2, 'retry@example.com');
    let submissions = 0;
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'POST') {
        submissions += 1;
        return Response.json({ data: submissions === 1
          ? [{ email: sent.email, outcome: 'sent', share: sent }, { email: failed.email, outcome: 'failed', message: 'Try again.' }]
          : [{ email: failed.email, outcome: 'sent', share: failed }] });
      }
      return submissions === 1
        ? Response.json({ message: 'List unavailable.' }, { status: 503 })
        : Response.json({ data: submissions ? [sent, failed] : [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: `${sent.email}, ${failed.email}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Magic Links · 2' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invitations were processed, but the access list could not refresh.');
    expect(screen.getByRole('status')).toHaveTextContent('1 Magic Link sent.');
    await waitFor(() => expect(screen.queryByRole('button', { name: `Remove ${sent.email}` })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: `Remove ${failed.email}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Magic Link · 1' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Send Magic Link · 1' }));
    await waitFor(() => expect(submissions).toBe(2));
    expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'POST')[1][1].body).toBe(JSON.stringify({ emails: [failed.email] }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('disables resend until the server cooldown expires even when resending is otherwise permitted', async () => {
    const coolingDown = { ...invitation(8, 'cooldown@example.com'), resend_available_at: new Date(Date.now() + 60_000).toISOString() };
    const fetchMock = vi.fn(async () => Response.json({ data: [coolingDown] }));
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Manage access/ }), { button: 0, ctrlKey: false });
    const row = await screen.findByRole('article', { name: `Access for ${coolingDown.email}` });
    const resend = within(row).getByRole('button', { name: `Resend invitation to ${coolingDown.email}` });

    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent(/Resend in \d+s/);
    fireEvent.click(resend);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['failed', 'sending'] as const)('can revoke an unexpired %s invitation', async status => {
    let share: GuestInvitation = { ...invitation(9, `${status}@example.com`), status, can_copy: false, can_resend: false };
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      if (options.method === 'DELETE') {
        share = { ...share, status: 'revoked', revoked_at: new Date().toISOString() };
        return Response.json({});
      }
      return Response.json({ data: [share] });
    });
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Manage access/ }), { button: 0, ctrlKey: false });
    const row = await screen.findByRole('article', { name: `Access for ${share.email}` });
    fireEvent.click(within(row).getByRole('button', { name: `Revoke access for ${share.email}` }));
    expect(fetchMock.mock.calls.some(([, options]) => options.method === 'DELETE')).toBe(false);
    fireEvent.click(within(row).getByRole('button', { name: /^Revoke$/ }));

    await screen.findByText(`Access revoked for ${share.email}.`);
    expect(fetchMock.mock.calls.find(([, options]) => options.method === 'DELETE')?.[0]).toMatch(/\/guest-shares\/9$/);
    expect(within(row).getByText('Revoked')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: `Revoke access for ${share.email}` })).not.toBeInTheDocument();
  });

  it('preserves recipient chips and an unfinished email draft across Invite and Manage tabs', async () => {
    const recipients = ['one@example.com', 'two@example.com', 'three@example.com'];
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => Response.json({ data: options.method === 'POST'
      ? recipients.map(email => ({ email, outcome: 'sent' })) : [] }));
    vi.stubGlobal('fetch', fetchMock);
    await openDialog();
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: recipients.slice(0, 2).join(', ') } });
    fireEvent.click(screen.getByRole('button', { name: 'Add recipient' }));
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: recipients[2] } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Manage access/ }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('tab', { name: /Manage access/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Invite people' }), { button: 0, ctrlKey: false });

    expect(screen.getByRole('tab', { name: 'Invite people' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: `Remove ${recipients[0]}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Remove ${recipients[1]}` })).toBeInTheDocument();
    expect(screen.getByLabelText('Send to')).toHaveValue(recipients[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Send Magic Links · 3' }));
    await screen.findByText('3 Magic Links sent.');
    expect(fetchMock.mock.calls.find(([, options]) => options.method === 'POST')?.[1].body).toBe(JSON.stringify({ emails: recipients }));
  });
});
