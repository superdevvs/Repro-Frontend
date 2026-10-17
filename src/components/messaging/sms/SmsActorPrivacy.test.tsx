import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SmsComposePane } from './SmsComposePane';
import { SmsGroupsDialog } from './SmsGroupsDialog';
import type { SmsDirectoryRecipient, SmsGroupRecord } from '@/services/messaging';

const auth = vi.hoisted(() => ({ user: { id: 1 }, role: 'admin' }));
const api = vi.hoisted(() => ({ groups: vi.fn(), directory: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/messaging', () => ({ getSmsGroups: api.groups, getSmsRecipients: api.directory, saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn() }));
vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: () => null,
  CommandSeparator: () => <hr />,
  CommandInput: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => <input aria-label="Search people" value={value} onChange={event => onValueChange(event.target.value)} />,
  CommandItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => <button onClick={onSelect}>{children}</button>,
}));

const person: SmsDirectoryRecipient = { id: 'user-7', user_id: 7, name: 'Private admin client', phone: '+17035550101', kind: 'client', subtitle: '+17035550101' };
const group: SmsGroupRecord = { id: 8, name: 'Private admin group', member_count: 1, members: [{ id: 7, name: person.name, phone: person.phone, user_id: 7 }] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}

beforeEach(() => { auth.user = { id: 1 }; auth.role = 'admin'; api.groups.mockReset(); api.directory.mockReset(); });
afterEach(cleanup);

it('isolates cached and delayed admin people/groups and clears selected recipients and drafts after impersonation', async () => {
  const oldGroups = deferred<SmsGroupRecord[]>();
  const oldPeople = deferred<SmsDirectoryRecipient[]>();
  const nextGroups = deferred<SmsGroupRecord[]>();
  const nextPeople = deferred<SmsDirectoryRecipient[]>();
  api.groups.mockImplementation(() => auth.user.id === 1 ? oldGroups.promise : nextGroups.promise);
  api.directory.mockImplementation(() => auth.user.id === 1 ? oldPeople.promise : nextPeople.promise);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['sms-groups', 1, 'admin'], [group]);
  client.setQueryData(['sms-directory', 1, 'admin', '', 20], [person]);
  const send = vi.fn();
  const app = () => <QueryClientProvider client={client}><SmsComposePane open onOpenChange={vi.fn()} onSend={send} /></QueryClientProvider>;
  const view = render(app());
  fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
  fireEvent.click(await screen.findByRole('button', { name: /Private admin group/ }));
  fireEvent.click(screen.getByRole('button', { name: 'People' }));
  fireEvent.click(await screen.findByRole('button', { name: /Private admin client/ }));
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Private admin draft' } });
  expect(screen.getByRole('button', { name: 'Send to 1 person and 1 group' })).toBeEnabled();

  auth.user = { id: 2 }; auth.role = 'photographer';
  view.rerender(app());
  expect(screen.getByLabelText('Message')).toHaveValue('');
  expect(screen.getByLabelText('To')).toHaveValue('');
  expect(screen.queryByText('Private admin group')).not.toBeInTheDocument();
  expect(screen.queryByText('Private admin client')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'People' }));
  await waitFor(() => expect(api.directory).toHaveBeenCalledTimes(2));
  await act(async () => {
    oldGroups.resolve([{ ...group, name: 'Late admin group' }]);
    oldPeople.resolve([{ ...person, name: 'Late admin client' }]);
  });
  expect(screen.queryByText(/admin (?:group|client|draft)/i)).not.toBeInTheDocument();
  expect(screen.queryByText(person.phone)).not.toBeInTheDocument();
  expect(client.getQueryData(['sms-groups', 1, 'admin'])).toEqual([{ ...group, name: 'Late admin group' }]);
  expect(client.getQueryData(['sms-groups', 2, 'photographer'])).toBeUndefined();
  expect(send).not.toHaveBeenCalled();
  client.clear();
});

it('also isolates a role change for the same user ID', async () => {
  api.groups.mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['sms-groups', 1, 'admin'], [group]);
  const app = () => <QueryClientProvider client={client}><SmsComposePane open onOpenChange={vi.fn()} onSend={vi.fn()} /></QueryClientProvider>;
  const view = render(app());
  fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
  fireEvent.click(await screen.findByRole('button', { name: /Private admin group/ }));
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Private draft' } });
  auth.role = 'photographer';
  view.rerender(app());
  expect(screen.queryByText('Private admin group')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  await waitFor(() => expect(api.groups).toHaveBeenCalledOnce());
  client.clear();
});

it('resets group editing and ignores a previous actor’s delayed role-recipient response', async () => {
  const oldRole = deferred<SmsDirectoryRecipient[]>();
  api.groups.mockResolvedValue([]);
  api.directory.mockImplementation(params => params?.role ? oldRole.promise : Promise.resolve([]));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['sms-groups', 1, 'admin'], [group]);
  const app = () => <QueryClientProvider client={client}><SmsGroupsDialog open onOpenChange={vi.fn()} /></QueryClientProvider>;
  const view = render(app());
  fireEvent.click(await screen.findByRole('button', { name: /Private admin group/ }));
  expect(screen.getByLabelText('Name')).toHaveValue(group.name);
  fireEvent.click(screen.getByRole('button', { name: 'All photographers' }));
  auth.user = { id: 2 }; auth.role = 'photographer';
  view.rerender(app());
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  expect(screen.queryByText(person.name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'New group' }));
  await act(async () => { oldRole.resolve([{ ...person, name: 'Late private recipient' }]); });
  expect(screen.getByLabelText('Name')).toHaveValue('');
  expect(screen.queryByText('Late private recipient')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save group' })).toBeDisabled();
  client.clear();
});
