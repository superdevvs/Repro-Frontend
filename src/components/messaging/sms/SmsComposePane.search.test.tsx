import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SmsDirectoryRecipient, SmsGroupRecord } from '@/services/messaging';
import { SmsComposePane } from './SmsComposePane';

const auth = vi.hoisted(() => ({ user: { id: 1 }, role: 'superadmin' }));
const api = vi.hoisted(() => ({ groups: vi.fn(), directory: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/messaging', () => ({
  getSmsGroups: api.groups, getSmsRecipients: api.directory,
  saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn(),
}));

const people: SmsDirectoryRecipient[] = [
  { id: 'user-12', user_id: 12, kind: 'user', name: 'Cameron Photographer', phone: '+17035550112', subtitle: 'Photographer' },
  { id: 'client-13', user_id: 13, kind: 'client', name: 'Lee Client', phone: '+17035550113', subtitle: 'Client' },
];
const groups: SmsGroupRecord[] = [
  { id: 8, name: 'Photographers', member_count: 44, members: [] },
  { id: 9, name: 'Sales team', member_count: 3, members: [] },
  { id: 10, name: 'Onsite crew', member_count: 2, members: [] },
];
const clients: QueryClient[] = [];

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const send = vi.fn();
  let sending = false;
  const app = () => <QueryClientProvider client={client}><SmsComposePane
    open onOpenChange={vi.fn()} onSend={send} sending={sending}
    senderNumbers={[{ id: 11, label: 'Main office', phone_number: '+17035550111', is_default: true }]}
  /></QueryClientProvider>;
  const view = render(app());
  return { send, setSending: (value: boolean) => { sending = value; view.rerender(app()); } };
}

beforeEach(() => {
  auth.user = { id: 1 }; auth.role = 'superadmin';
  api.groups.mockReset().mockResolvedValue(groups);
  api.directory.mockReset().mockImplementation(async (params?: { search?: string }) => {
    const search = params?.search?.toLowerCase() ?? '';
    return people.filter(person => `${person.name} ${person.phone}`.toLowerCase().includes(search));
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe('SMS compose recipient search', () => {
  it('uses To to request matching people with trimmed search text', async () => {
    const user = userEvent.setup(); mount();
    const search = screen.getByLabelText('To');
    expect(search).toBeEnabled();
    expect(search).toHaveValue('');

    await user.type(search, '  Cameron  ');

    await waitFor(() => expect(api.directory).toHaveBeenLastCalledWith({ search: 'Cameron', limit: 20 }));
    expect(await screen.findByRole('button', { name: /Cameron Photographer/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lee Client/ })).not.toBeInTheDocument();
    expect(search).toHaveValue('  Cameron  ');
  });

  it('shares the search text between People and Groups and matches group names without case or surrounding-space differences', async () => {
    const user = userEvent.setup(); mount();
    const search = screen.getByLabelText('To');
    await user.type(search, '  PHOTO  ');
    await waitFor(() => expect(api.directory).toHaveBeenLastCalledWith({ search: 'PHOTO', limit: 20 }));
    expect(await screen.findByRole('button', { name: /Cameron Photographer/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Groups' }));

    expect(search).toHaveValue('  PHOTO  ');
    expect(await screen.findByRole('button', { name: /^Photographers\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sales team\b/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Onsite crew\b/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'People' }));
    expect(search).toHaveValue('  PHOTO  ');
    expect(await screen.findByRole('button', { name: /Cameron Photographer/ })).toBeInTheDocument();
  });

  it('preserves selected groups while changing and clearing search, including when the selected group is filtered out', async () => {
    const user = userEvent.setup(); const { send } = mount();
    await user.click(screen.getByRole('button', { name: 'Groups' }));
    await user.click(await screen.findByRole('button', { name: /^Photographers\b/ }));
    expect(screen.getByRole('button', { name: 'Remove group Photographers' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('To'), 'crew');

    expect(await screen.findByRole('button', { name: /^Onsite crew\b/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Photographers\b/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove group Photographers' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear recipient search' }));
    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(await screen.findByRole('button', { name: /^Photographers\b/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Sales team\b/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Message'), 'Message for the selected photographers');
    await user.click(screen.getByRole('button', { name: 'Send to 1 group' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ group_ids: [8], smsNumberId: 11 }));
  });

  it('clears search without losing a selected person or the message draft', async () => {
    const user = userEvent.setup(); mount();
    await user.type(screen.getByLabelText('To'), '+17035550199{Enter}');
    await user.type(screen.getByLabelText('Message'), 'Keep this message draft');
    await user.type(screen.getByLabelText('To'), 'Cameron');
    await waitFor(() => expect(api.directory).toHaveBeenLastCalledWith({ search: 'Cameron', limit: 20 }));

    await user.click(screen.getByRole('button', { name: 'Clear recipient search' }));

    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Remove +17035550199' })).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveValue('Keep this message draft');
    await waitFor(() => expect(api.directory).toHaveBeenLastCalledWith({ search: undefined, limit: 20 }));
  });

  it('shows an empty match result for group search while retaining the selected group chip', async () => {
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole('button', { name: 'Groups' }));
    await user.click(await screen.findByRole('button', { name: /^Sales team\b/ }));

    await user.type(screen.getByLabelText('To'), 'No such group');

    expect(await screen.findByText(/^No matching groups\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Photographers\b/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sales team\b/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove group Sales team' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage' })).toBeInTheDocument();
  });

  it('disables search and its clear control while a message is sending', async () => {
    const user = userEvent.setup(); const view = mount();
    await user.type(screen.getByLabelText('To'), 'Cameron');
    view.setSending(true);

    expect(screen.getByLabelText('To')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear recipient search' })).toBeDisabled();
    expect(screen.getByLabelText('To')).toHaveValue('Cameron');
  });
});
