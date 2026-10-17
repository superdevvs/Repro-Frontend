import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSmsRealtime } from './use-sms-realtime';

const echo = vi.hoisted(() => ({ private: vi.fn(), leaveChannel: vi.fn() }));
vi.mock('@/realtime/echoClient', () => ({ isRealtimeEnabled: () => true, getEchoClient: async () => echo }));
const channel = () => {
  type Handler = (event: unknown) => void;
  const handlers = new Map<string, Set<Handler>>();
  return {
    listen: vi.fn(function (this: unknown, name: string, handler: Handler) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(handler);
      return this;
    }),
    stopListening: vi.fn((name: string, handler?: Handler) => {
      if (handler) handlers.get(name)?.delete(handler);
      else handlers.delete(name);
    }),
    unsubscribe: vi.fn(),
    dispatch: (name: string, event: unknown) => handlers.get(name)?.forEach(handler => handler(event)),
  };
};
const cachedChannels = new Map<string, ReturnType<typeof channel>>();
beforeEach(() => {
  cachedChannels.clear();
  echo.private.mockReset().mockImplementation((name: string) => {
    if (!cachedChannels.has(name)) cachedChannels.set(name, channel());
    return cachedChannels.get(name)!;
  });
  echo.leaveChannel.mockReset().mockImplementation((name: string) => {
    const key = name.replace(/^private-/, '');
    cachedChannels.get(key)?.unsubscribe();
    cachedChannels.delete(key);
  });
});
afterEach(cleanup);

it.each([false, true])('subscribes to admin system updates only when permitted (%s)', async includeSystem => {
  const { unmount } = renderHook(() => useSmsRealtime({ threadId: '123', includeSystem }));
  await waitFor(() => expect(echo.private).toHaveBeenCalledWith('sms.thread.123'));
  expect(echo.private.mock.calls.map(([name]) => name)).toEqual([
    'sms.thread-list', ...(includeSystem ? ['sms.system-thread-list'] : []), 'sms.thread.123',
  ]);
  const channels = echo.private.mock.results.map(result => result.value);
  unmount();
  channels.forEach(channel => expect(channel.unsubscribe).toHaveBeenCalledOnce());
});

it('uses current callbacks without resubscribing on each search render', async () => {
  const first = vi.fn(), latest = vi.fn();
  const { rerender } = renderHook(({ onThreadUpdated }) => useSmsRealtime({ onThreadUpdated }), { initialProps: { onThreadUpdated: first } });
  await waitFor(() => expect(echo.private).toHaveBeenCalledOnce());
  rerender({ onThreadUpdated: latest });
  const handler = echo.private.mock.results[0].value.listen.mock.calls.find(([name]: [string]) => name === '.SmsThreadUpdated')[1];
  handler({ thread: { id: '456' } });
  expect(latest).toHaveBeenCalledWith({ id: '456' });
  expect(first).not.toHaveBeenCalled();
  expect(echo.private).toHaveBeenCalledOnce();
});

it('uses the photographer own updates channel without subscribing to company conversations', async () => {
  renderHook(() => useSmsRealtime({ personalOnly: true, userId: 42 }));
  await waitFor(() => expect(echo.private).toHaveBeenCalledOnce());
  expect(echo.private).toHaveBeenCalledWith('sms.user.42');
});

it('keeps another mounted consumer listening when a conversation changes or unmounts', async () => {
  const notifications = vi.fn(), inbox = vi.fn();
  const header = renderHook(() => useSmsRealtime({ onThreadUpdated: notifications }));
  await waitFor(() => expect(echo.private).toHaveBeenCalledOnce());
  const list = echo.private.mock.results[0].value;
  const center = renderHook(({ threadId }) => useSmsRealtime({ threadId, onThreadUpdated: inbox }), { initialProps: { threadId: '123' } });
  await waitFor(() => expect(echo.private).toHaveBeenCalledWith('sms.thread.123'));
  expect(echo.private.mock.calls.filter(([name]) => name === 'sms.thread-list')).toHaveLength(1);
  const event = { thread: { id: '456' } };
  list.dispatch('.SmsThreadUpdated', event);
  expect(notifications).toHaveBeenCalledOnce();
  expect(inbox).toHaveBeenCalledOnce();

  center.rerender({ threadId: '456' });
  await waitFor(() => expect(echo.private).toHaveBeenCalledWith('sms.thread.456'));
  expect(list.unsubscribe).not.toHaveBeenCalled();
  list.dispatch('.SmsThreadUpdated', event);
  expect(notifications).toHaveBeenCalledTimes(2);
  expect(inbox).toHaveBeenCalledTimes(2);

  center.unmount();
  expect(list.unsubscribe).not.toHaveBeenCalled();
  list.dispatch('.SmsThreadUpdated', event);
  expect(notifications).toHaveBeenCalledTimes(3);
  expect(inbox).toHaveBeenCalledTimes(2);
  expect(list.stopListening.mock.calls.every(([, handler]: [string, unknown]) => typeof handler === 'function')).toBe(true);
  header.unmount();
  expect(list.unsubscribe).toHaveBeenCalledOnce();
});

it('does not subscribe while disabled and releases its owned listeners when disabled again', async () => {
  const { rerender } = renderHook(({ enabled }) => useSmsRealtime({ enabled }), { initialProps: { enabled: false } });
  expect(echo.private).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(echo.private).toHaveBeenCalledOnce());
  const list = echo.private.mock.results[0].value;
  rerender({ enabled: false });
  expect(list.stopListening).toHaveBeenCalledTimes(3);
  expect(list.unsubscribe).toHaveBeenCalledOnce();
});

it('leaves Echo cache before resubscribing after the last consumer unmounts', async () => {
  const first = renderHook(() => useSmsRealtime({}));
  await waitFor(() => expect(echo.private).toHaveBeenCalledOnce());
  const previous = echo.private.mock.results[0].value;
  first.unmount();
  expect(echo.leaveChannel).toHaveBeenCalledWith('private-sms.thread-list');
  expect(previous.unsubscribe).toHaveBeenCalledOnce();
  const onThreadUpdated = vi.fn();
  renderHook(() => useSmsRealtime({ onThreadUpdated }));
  await waitFor(() => expect(echo.private).toHaveBeenCalledTimes(2));
  const current = echo.private.mock.results[1].value;
  expect(current).not.toBe(previous);
  current.dispatch('.SmsThreadUpdated', { thread: { id: '456' } });
  expect(onThreadUpdated).toHaveBeenCalledWith({ id: '456' });
});
