import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StaffEmailRoute } from './StaffEmailRoute';
import { canSendExternalEmail, canUseEmailWorkspace } from '@/utils/messagingRoles';
import { readSupportComposePrefill, readSupportReplyPrefill } from './messagingSupport';

const auth = vi.hoisted(() => ({ role: 'client', user: { id: '12', secondary_roles: ['admin'] }, isLoading: false }));
const lookup = vi.hoisted(() => vi.fn());
const email = vi.hoisted(() => vi.fn());
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/supportTickets', () => ({ getLegacySupportTicket: lookup }));
beforeEach(() => { auth.role = 'client'; auth.isLoading = false; localStorage.clear(); lookup.mockReset(); email.mockReset(); });
afterEach(cleanup);
function Email() { email(); return <h1>Email tools</h1>; }
function Destination() { const location = useLocation(); return <><output data-testid="url">{location.pathname}{location.search}{location.hash}</output><output data-testid="state">{JSON.stringify(location.state)}</output></>; }
function view(path: string, state?: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}><Routes><Route path="/messaging/email/inbox" element={<Destination />} /><Route path="/messaging/email/compose" element={<StaffEmailRoute compose><Email /></StaffEmailRoute>} /><Route path="*" element={<StaffEmailRoute><Email /></StaffEmailRoute>} /></Routes></MemoryRouter></QueryClientProvider>);
}

it.each(['client', 'photographer', 'editor', 'salesRep', 'sales_rep', 'rep', 'unknown'])('routes %s to Support despite a secondary admin role', async role => {
  auth.role = role; view('/messaging/overview');
  expect(await screen.findByTestId('url')).toHaveTextContent('/messaging/email/inbox?tab=support');
  expect(email).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
});
it.each(['admin', 'superadmin', 'editing_manager', 'Editing Manager', 'editing-manager'])('retains the staff email workspace for %s', role => {
  auth.role = role; view('/messaging/overview');
  expect(screen.getByRole('heading', { name: 'Email tools' })).toBeVisible();
  expect(canUseEmailWorkspace(role)).toBe(true); expect(canSendExternalEmail(role)).toBe(true);
});
it('does not redirect or mount email while authentication is loading', () => {
  auth.isLoading = true; view('/messaging/overview'); expect(email).not.toHaveBeenCalled(); expect(screen.queryByTestId('url')).not.toBeInTheDocument();
});
it('preserves the account compose draft and attachment reminders without putting text into the URL', async () => {
  localStorage.setItem('email-compose-draft:12:compose:new', JSON.stringify({ version: 1, form: { subject: 'My upload issue', body_text: 'These are the details I already wrote.' }, attachments: [{ name: 'screenshot.png' }] }));
  view('/messaging/email/compose?subject=Older&body=Older', { prefillBody: 'Older state' });
  expect(await screen.findByTestId('url')).toHaveTextContent('/messaging/email/inbox?new=1&tab=support');
  const state = JSON.parse(screen.getByTestId('state').textContent!);
  expect(readSupportComposePrefill(state, 12)).toEqual({ ownerId: '12', subject: 'My upload issue', body: 'These are the details I already wrote.', attachmentNames: ['screenshot.png'] });
  expect(readSupportComposePrefill(state, 99)).toBeUndefined();
  expect(localStorage.getItem('email-compose-draft:12:compose:new')).not.toBeNull(); expect(email).not.toHaveBeenCalled();
});
it.each(['client', 'admin'])('resolves imported message links for %s without mounting the ordinary email workspace', async role => {
  auth.role = role; lookup.mockResolvedValue({ support_ticket_id: 61 }); view('/messaging/overview?message=25');
  expect(await screen.findByTestId('url')).toHaveTextContent('/messaging/email/inbox?ticket=61&tab=support');
  expect(lookup).toHaveBeenCalledWith(25, expect.any(AbortSignal)); expect(email).not.toHaveBeenCalled();
});
it('preserves a mapped reply draft in the original support conversation, without sending it', async () => {
  lookup.mockResolvedValue({ support_ticket_id: 61 }); view('/messaging/email/compose', { mode: 'reply', message: { id: 25, subject: 'Upload help' }, prefillBody: 'Here is my update.' });
  expect(await screen.findByTestId('url')).toHaveTextContent('ticket=61');
  const state = JSON.parse(screen.getByTestId('state').textContent!);
  expect(readSupportReplyPrefill(state, 12, 61)?.body).toBe('Here is my update.');
  expect(readSupportReplyPrefill(state, 99, 61)).toBeUndefined(); expect(readSupportReplyPrefill(state, 12, 62)).toBeUndefined();
  expect(screen.getByTestId('url')).not.toHaveTextContent('new=1'); expect(email).not.toHaveBeenCalled();
});
it('keeps ordinary staff email links when no support mapping exists', async () => {
  auth.role = 'admin'; lookup.mockRejectedValue({ response: { status: 404 } }); view('/messaging/overview?message=25');
  expect(await screen.findByRole('heading', { name: 'Email tools' })).toBeVisible();
});
it('shows a retry on lookup failure rather than losing the request link', async () => {
  lookup.mockRejectedValue({ response: { status: 503 } }); view('/messaging/overview?message=25');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not open this request'));
  expect(email).not.toHaveBeenCalled(); expect(screen.queryByTestId('url')).not.toBeInTheDocument();
});
