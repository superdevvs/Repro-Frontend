import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';
import { getEchoClient, getEchoClientGeneration, isRealtimeEnabled, subscribeEchoClientChanges } from '@/realtime/echoClient';

type SmsRealtimeOptions = {
  enabled?: boolean;
  threadId?: string | null;
  includeSystem?: boolean;
  personalOnly?: boolean;
  userId?: string | number;
  onMessage?: (message: SmsMessageDetail) => void;
  onThreadUpdated?: (thread: SmsThreadSummary) => void;
};

type SmsEchoClient = NonNullable<Awaited<ReturnType<typeof getEchoClient>>>;
type SmsEchoChannel = ReturnType<SmsEchoClient['private']>;

const sharedChannels = new WeakMap<SmsEchoClient, Map<string, { channel: SmsEchoChannel; consumers: number }>>();

const retainChannel = (echo: SmsEchoClient, name: string) => {
  let channels = sharedChannels.get(echo);
  if (!channels) {
    channels = new Map();
    sharedChannels.set(echo, channels);
  }
  let record = channels.get(name);
  if (!record) {
    record = { channel: echo.private(name), consumers: 0 };
    channels.set(name, record);
  }
  record.consumers += 1;
  let released = false;
  return {
    channel: record.channel,
    release: () => {
      if (released) return;
      released = true;
      record.consumers -= 1;
      if (record.consumers === 0) {
        // Echo caches private channels. Leaving removes that cache entry so
        // the next mount can subscribe again instead of reusing a dead channel.
        echo.leaveChannel(`private-${name}`);
        channels.delete(name);
      }
    },
  };
};

export const useSmsRealtime = ({ enabled = true, threadId, includeSystem = false, personalOnly = false, userId, onMessage, onThreadUpdated }: SmsRealtimeOptions) => {
  const generation = useSyncExternalStore(subscribeEchoClientChanges, getEchoClientGeneration, getEchoClientGeneration);
  const callbacks = useRef({ onMessage, onThreadUpdated });
  useEffect(() => { callbacks.current = { onMessage, onThreadUpdated }; }, [onMessage, onThreadUpdated]);
  useEffect(() => {
    let isMounted = true;
    const removeListeners: Array<() => void> = [];
    const releaseChannels: Array<() => void> = [];

    const listen = <Event,>(channel: SmsEchoChannel, eventName: string, handler: (event: Event) => void) => {
      channel.listen(eventName, handler);
      removeListeners.push(() => channel.stopListening(eventName, handler));
    };

    const channelFor = (echo: SmsEchoClient, name: string) => {
      const subscription = retainChannel(echo, name);
      releaseChannels.push(subscription.release);
      return subscription.channel;
    };

    const bindHandlers = async () => {
      if (!enabled || !isRealtimeEnabled()) return;
      const echo = await getEchoClient();
      if (!echo || !isMounted) return;

      const listNames = personalOnly ? (userId ? [`sms.user.${userId}`] : []) : ['sms.thread-list'];
      for (const name of [...listNames, ...(includeSystem ? ['sms.system-thread-list'] : [])]) {
        const listChannel = channelFor(echo, name);
        listen(listChannel, '.SmsThreadUpdated', (event: { thread: SmsThreadSummary }) => {
          callbacks.current.onThreadUpdated?.(event.thread);
        });
        listen(listChannel, '.SmsMessageReceived', (event: { message: SmsMessageDetail; threadId: string }) => {
          if (!threadId || event.threadId !== String(threadId)) {
            callbacks.current.onThreadUpdated?.({ id: event.threadId } as SmsThreadSummary);
          }
        });
        listen(listChannel, '.SmsMessageSent', (event: { message: SmsMessageDetail; threadId: string }) => {
          if (!threadId || event.threadId !== String(threadId)) {
            callbacks.current.onThreadUpdated?.({ id: event.threadId } as SmsThreadSummary);
          }
        });
      }

      if (threadId) {
        const threadChannel = channelFor(echo, `sms.thread.${threadId}`);
        listen(threadChannel, '.SmsMessageReceived', (event: { message: SmsMessageDetail }) => {
          callbacks.current.onMessage?.(event.message);
        });
        listen(threadChannel, '.SmsMessageSent', (event: { message: SmsMessageDetail }) => {
          callbacks.current.onMessage?.(event.message);
        });
      }
    };

    bindHandlers();

    return () => {
      isMounted = false;
      removeListeners.forEach(remove => remove());
      releaseChannels.forEach(release => release());
    };
  }, [enabled, threadId, includeSystem, personalOnly, userId, generation]);
};

