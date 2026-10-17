import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SmsComposePane } from './SmsComposePane';
import { SmsSenderSelect } from './SmsSenderSelect';
import type { SmsNumberConfig } from '@/types/messaging';

const auth = vi.hoisted(() => ({ user: { id: 1 }, role: 'superadmin' }));
const api = vi.hoisted(() => ({ groups: vi.fn(), directory: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/messaging', () => ({ getSmsGroups: api.groups, getSmsRecipients: api.directory, saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn() }));

const numbers: SmsNumberConfig[] = [
  { id: 24, label: 'Production', phone_number: '+17035550124' },
  { id: 11, label: 'Main office', phone_number: '+17035550111', is_default: true },
];

beforeEach(() => {
  auth.user = { id: 1 }; auth.role = 'superadmin';
  api.groups.mockReset().mockResolvedValue([{ id: 8, name: 'Onsite crew', member_count: 2, members: [] }]);
  api.directory.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

function view(initial: Partial<React.ComponentProps<typeof SmsComposePane>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const send = vi.fn();
  let props = { open: true, onOpenChange: vi.fn(), onSend: send, senderNumbers: numbers, ...initial };
  const app = () => <QueryClientProvider client={client}><SmsComposePane {...props} /></QueryClientProvider>;
  const result = render(app());
  return { send, rerender: (next: Partial<React.ComponentProps<typeof SmsComposePane>>) => { props = { ...props, ...next }; result.rerender(app()); } };
}

function addPhone(phone = '+17035550999') {
  fireEvent.change(screen.getByLabelText('To'), { target: { value: phone } });
  fireEvent.keyDown(screen.getByLabelText('To'), { key: 'Enter' });
}

it.each(['single', 'multiple', 'group'] as const)('sends the selected configured sender for a %s audience', async audience => {
  const { send, rerender } = view();
  expect(screen.getByLabelText('SMS sender number')).toHaveValue('11');
  expect(screen.getByRole('option', { name: /Main office.*Default/ })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('SMS sender number'), { target: { value: '24' } });
  if (audience === 'group') {
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    fireEvent.click(await screen.findByRole('button', { name: /Onsite crew/ }));
  }
  else {
    addPhone();
    if (audience === 'multiple') addPhone('+17035550888');
  }
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Meet at the property.' } });
  rerender({ senderNumbers: [...numbers] });
  expect(screen.getByLabelText('SMS sender number')).toHaveValue('24');
  fireEvent.click(screen.getByRole('button', { name: /^Send to / }));
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0]).toMatchObject({ bodyText: 'Meet at the property.', smsNumberId: 24 });
  if (audience === 'single') expect(send.mock.calls[0][0].to).toBe('+17035550999');
  if (audience === 'multiple') expect(send.mock.calls[0][0].recipients).toHaveLength(2);
  if (audience === 'group') expect(send.mock.calls[0][0].group_ids).toEqual([8]);
});

it.each(['admin', 'editing_manager', 'salesRep', 'photographer', 'client', 'editor'])('does not expose or submit a sender override for %s', role => {
  auth.role = role;
  const forgedProps = { senderNumbers: numbers, smsNumberId: 24 };
  const { send } = view(forgedProps);
  expect(screen.queryByLabelText('SMS sender number')).not.toBeInTheDocument();
  addPhone();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Normal message' } });
  fireEvent.click(screen.getByRole('button', { name: /^Send to / }));
  expect(send.mock.calls[0][0]).not.toHaveProperty('smsNumberId');
});

it('returns to the configured default on reopen and actor change, clearing the previous compose', async () => {
  const { rerender } = view();
  fireEvent.change(screen.getByLabelText('SMS sender number'), { target: { value: '24' } });
  addPhone();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Old compose draft' } });
  rerender({ open: false });
  rerender({ open: true });
  expect(screen.getByLabelText('SMS sender number')).toHaveValue('11');
  expect(screen.getByLabelText('Message')).toHaveValue('');
  expect(screen.getByLabelText('To')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('SMS sender number'), { target: { value: '24' } });
  auth.user = { id: 2 };
  rerender({});
  expect(screen.getByLabelText('SMS sender number')).toHaveValue('11');
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  await waitFor(() => expect(api.groups).toHaveBeenCalled());
});

it('re-evaluates a removed sender and uses the default when configuration arrives after loading', async () => {
  const { send, rerender } = view({ senderNumbers: [], senderNumbersLoading: true });
  addPhone();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Ready to send' } });
  expect(screen.getByRole('button', { name: /^Send to / })).toBeDisabled();
  rerender({ senderNumbers: numbers, senderNumbersLoading: false });
  await waitFor(() => expect(screen.getByLabelText('SMS sender number')).toHaveValue('11'));
  fireEvent.change(screen.getByLabelText('SMS sender number'), { target: { value: '24' } });
  rerender({ senderNumbers: [numbers[1]] });
  await waitFor(() => expect(screen.getByLabelText('SMS sender number')).toHaveValue('11'));
  fireEvent.click(screen.getByRole('button', { name: /^Send to / }));
  expect(send.mock.calls[0][0].smsNumberId).toBe(11);
});

it('blocks sending while sender retrieval fails or there are no configured senders and supports retry', () => {
  const retry = vi.fn();
  const { send, rerender } = view({ senderNumbersError: true, onRetrySenderNumbers: retry });
  addPhone();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Ready to send' } });
  expect(screen.getByLabelText('SMS sender number')).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Send to / })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(retry).toHaveBeenCalledOnce();
  rerender({ senderNumbers: [], senderNumbersError: false });
  expect(screen.getByLabelText('SMS sender number')).toBeDisabled();
  expect(screen.getByRole('button', { name: /^Send to / })).toBeDisabled();
  expect(send).not.toHaveBeenCalled();
});

it('only offers saved sender numbers and ignores an arbitrary value', () => {
  const change = vi.fn();
  render(<SmsSenderSelect numbers={[...numbers, { phone_number: '+17035550777' }, { id: 0, phone_number: '+17035550666' }]} value={11} onChange={change} />);
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.queryByRole('option', { name: /5550777|5550666/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('SMS sender number'), { target: { value: '999' } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('SMS sender number'), { target: { value: '24' } });
  expect(change).toHaveBeenCalledWith(24);
});

it('composes in a normal pane and searches people directly from To without a modal overlay', async () => {
  const user = userEvent.setup();
  api.directory.mockResolvedValue([{ id: 'user-12', user_id: 12, kind: 'user', name: 'Cameron Photographer', phone: '+17035550888', subtitle: 'Photographer' }]);
  const { send } = view({ templates: [{ id: 'visit', name: 'On my way', body_text: 'I am on my way to the property.' }] });
  expect(screen.getByRole('region', { name: 'New SMS' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Onsite crew/ })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('To'), 'Cameron');
  await waitFor(() => expect(api.directory).toHaveBeenLastCalledWith({ search: 'Cameron', limit: 20 }));
  await user.click(await screen.findByRole('button', { name: /Cameron Photographer/ }));
  expect(screen.getByLabelText('To')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Remove Cameron Photographer' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Template' }));
  await user.click(screen.getByRole('menuitem', { name: 'On my way' }));
  expect(screen.getByLabelText('Message')).toHaveValue('I am on my way to the property.');
  await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: '+17035550888', bodyText: 'I am on my way to the property.' }));
});

it('locks the draft and audience while a send is pending', async () => {
  const onOpenChange = vi.fn();
  const { send, rerender } = view({ onOpenChange, templates: [{ id: 1, name: 'Visit', body_text: 'Hello' }] });
  addPhone();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Keep this draft steady' } });
  rerender({ sending: true });
  expect(screen.getByLabelText('To')).toBeDisabled();
  expect(screen.getByLabelText('Message')).toBeDisabled();
  expect(screen.getByLabelText('SMS sender number')).toBeDisabled();
  for (const label of ['People', 'Groups', 'Template', 'Cancel', 'Close new SMS', 'Remove +17035550999', 'Send to 1 person']) {
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send to 1 person' }));
  expect(send).not.toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalled();
});

it('keeps the message when people loading fails and lets the user retry', async () => {
  api.directory.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
  view();
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'A draft worth keeping' } });
  fireEvent.click(screen.getByRole('button', { name: 'People' }));
  expect(await screen.findByText('Could not load people.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry people' }));
  expect(await screen.findByText('No matching people. You can also enter a phone number.')).toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('A draft worth keeping');
});

it('puts the message first when writing begins, keeping recipients and the directory search', async () => {
  const user = userEvent.setup();
  const { send } = view();
  addPhone();
  await user.type(screen.getByLabelText('To'), 'Cameron');
  expect(screen.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'true');
  await user.click(screen.getByLabelText('Message'));
  expect(screen.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('button', { name: 'Remove +17035550999' })).toBeInTheDocument();
  expect(screen.getByLabelText('To')).toHaveValue('Cameron');
  await user.type(screen.getByLabelText('Message'), 'Ready for the shoot');
  await user.click(screen.getByRole('button', { name: 'Send to 1 person' }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: '+17035550999', bodyText: 'Ready for the shoot' }));
  await user.click(screen.getByRole('button', { name: 'People' }));
  expect(screen.getByRole('button', { name: 'People' })).toHaveAttribute('aria-expanded', 'true');
  await waitFor(() => expect(api.directory).toHaveBeenLastCalledWith({ search: 'Cameron', limit: 20 }));
});

it('selects a matching person from a full phone search without blur adding and removing them', async () => {
  const user = userEvent.setup();
  const person = { id: 'user-12', user_id: 12, kind: 'user', name: 'Cameron Photographer', phone: '+17035550888', subtitle: 'Photographer' };
  api.directory.mockResolvedValue([person]);
  const { send } = view();
  await user.type(screen.getByLabelText('To'), person.phone);
  await waitFor(() => expect(api.directory).toHaveBeenLastCalledWith({ search: person.phone, limit: 20 }));
  await user.click(await screen.findByRole('button', { name: /Cameron Photographer/ }));
  expect(screen.getByRole('button', { name: 'Remove Cameron Photographer' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: `Remove ${person.phone}` })).not.toBeInTheDocument();
  expect(screen.getByLabelText('To')).toHaveValue('');
  await user.type(screen.getByLabelText('To'), '+17035550777');
  await user.keyboard('{Enter}');
  await user.type(screen.getByLabelText('Message'), 'Meet at the property.');
  await user.click(screen.getByRole('button', { name: 'Send to 2 people' }));
  expect(send).toHaveBeenCalledOnce();
  const selected = send.mock.calls[0][0].recipients;
  expect(selected).toHaveLength(2);
  expect(selected.filter((recipient: { user_id?: number }) => recipient.user_id === person.user_id)).toEqual([
    { phone: person.phone, name: person.name, user_id: person.user_id },
  ]);
});
