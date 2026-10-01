import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import EmailInbox from './EmailInbox';
import { supportInboxRedirect } from './messagingSupport';

const state = vi.hoisted(() => ({ role: 'admin', permissions: new Set<string>(), email: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ role: state.role }) }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ can: (resource: string, action: string) => state.permissions.has(`${resource}:${action}`) }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/use-page-loading', () => ({ usePageLoading: () => undefined }));
vi.mock('@/components/layout/DashboardLayout', () => ({ DashboardLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/pages/Support', () => ({ default: () => <h1>Support requests</h1> }));
vi.mock('@/components/messaging/email/EmailMessageList', () => ({ EmailMessageList: () => <h1>Existing contact conversations</h1> }));
vi.mock('@/components/messaging/email/EmailMessageDetail', () => ({ EmailMessageDetail: () => null }));
vi.mock('@/services/messaging', () => ({ getEmailMessages: state.email, getEmailMessage: vi.fn(), markEmailThreadRead: vi.fn() }));
beforeEach(() => { state.role = 'admin'; state.permissions = new Set(['support:view', 'messaging-email:view', 'messaging-compose:create', 'messaging-templates:view', 'messaging-automations:view', 'messaging-overview:view', 'messaging-settings:view']); state.email.mockReset().mockResolvedValue({ data: [] }); });
afterEach(cleanup);
function view(path = '/messaging/email/inbox?tab=support') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><EmailInbox /></MemoryRouter></QueryClientProvider>);
}

it('embeds Support in existing messaging tabs without fetching email until Inbox is selected', async () => {
  view();
  expect(screen.getByRole('heading', { name: 'Support requests' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('link', { name: 'Compose' })).not.toBeInTheDocument();
  expect(state.email).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link', { name: 'Inbox' }));
  await waitFor(() => expect(state.email).toHaveBeenCalledOnce());
  expect(screen.getByRole('heading', { name: 'Existing contact conversations' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Compose' })).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Support' }));
  expect(screen.getByRole('heading', { name: 'Support requests' })).toBeVisible();
});

it.each(['photographer', 'editor', 'salesRep'])('does not mount email or reveal staff tabs for support-only %s', role => {
  state.role = role; state.permissions = new Set(['support:view']); view();
  expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Support']);
  expect(state.email).not.toHaveBeenCalled();
});

it.each(['client', 'photographer', 'editor', 'salesRep'])('routes %s legacy email access into Support even when email permissions remain', async role => {
  state.role = role; view('/messaging/email/inbox');
  expect(await screen.findByRole('heading', { name: 'Support requests' })).toBeVisible();
  expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual(['Support']);
  expect(state.email).not.toHaveBeenCalled();
});

it('retains permitted email tools for an editing manager', async () => {
  state.role = 'editing_manager'; view('/messaging/email/inbox');
  expect(await screen.findByRole('link', { name: 'Compose' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Templates' })).toBeVisible();
  await waitFor(() => expect(state.email).toHaveBeenCalledOnce());
});

it('does not offer Support when the permission is denied', () => {
  state.permissions.delete('support:view'); view('/messaging/email/inbox');
  expect(screen.queryByRole('link', { name: 'Support' })).not.toBeInTheDocument();
});

it('preserves legacy ticket, new-request and hash parameters while selecting the Support tab', () => {
  const destination = new URL(supportInboxRedirect('?ticket=29&new=1&tab=old', '#reply'), 'https://example.test');
  expect(destination.pathname).toBe('/messaging/email/inbox');
  expect(Object.fromEntries(destination.searchParams)).toEqual({ ticket: '29', new: '1', tab: 'support' });
  expect(destination.hash).toBe('#reply');
});
