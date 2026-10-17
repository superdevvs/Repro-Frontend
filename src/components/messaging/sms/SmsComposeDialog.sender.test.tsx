import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SmsComposeDialog } from './SmsComposeDialog';
import { SmsSenderSelect } from './SmsSenderSelect';
import type { SmsNumberConfig } from '@/types/messaging';

const auth = vi.hoisted(() => ({ user: { id: 1 }, role: 'superadmin' }));
const api = vi.hoisted(() => ({ groups: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/services/messaging', () => ({ getSmsGroups: api.groups, getSmsRecipients: vi.fn().mockResolvedValue([]), saveSmsGroup: vi.fn(), deleteSmsGroup: vi.fn() }));

const numbers: SmsNumberConfig[] = [
  { id: 24, label: 'Production', phone_number: '+17035550124' },
  { id: 11, label: 'Main office', phone_number: '+17035550111', is_default: true },
];

beforeEach(() => {
  auth.user = { id: 1 }; auth.role = 'superadmin';
  api.groups.mockReset().mockResolvedValue([{ id: 8, name: 'Onsite crew', member_count: 2, members: [] }]);
});
afterEach(cleanup);

function view(initial: Partial<React.ComponentProps<typeof SmsComposeDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const send = vi.fn();
  let props = { open: true, onOpenChange: vi.fn(), onSend: send, senderNumbers: numbers, ...initial };
  const app = () => <QueryClientProvider client={client}><SmsComposeDialog {...props} /></QueryClientProvider>;
  const result = render(app());
  return { send, rerender: (next: Partial<React.ComponentProps<typeof SmsComposeDialog>>) => { props = { ...props, ...next }; result.rerender(app()); } };
}

function addPhone(phone = '+17035550999') {
  fireEvent.change(screen.getByLabelText('To'), { target: { value: phone } });
  fireEvent.keyDown(screen.getByLabelText('To'), { key: 'Enter' });
}

it.each(['single', 'multiple', 'group'] as const)('sends the selected configured sender for a %s audience', async audience => {
  const { send, rerender } = view();
  expect(screen.getByLabelText('SMS sender number')).toHaveValue('11');
  expect(screen.getByText('Default')).toBeVisible();
  fireEvent.change(screen.getByLabelText('SMS sender number'), { target: { value: '24' } });
  if (audience === 'group') fireEvent.click(await screen.findByRole('button', { name: /Onsite crew/ }));
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
