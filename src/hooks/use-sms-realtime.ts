import { useEffect } from 'react';
import type { SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';

type SmsRealtimeOptions = {
  threadId?: string | null;
  onMessage?: (message: SmsMessageDetail) => void;
  onThreadUpdated?: (thread: SmsThreadSummary) => void;
};

const getEcho = async () => {
  if (typeof window === 'undefined') return null;
  if (window.Echo) return window.Echo;

  const key = import.meta.env.VITE_PUSHER_APP_KEY;
  if (!key) return null;

  const [{ default: Echo }, { default: Pusher }] = await Promise.all([
    import('laravel-echo'),
    import('pusher-js'),
  ]);

  window.Pusher = Pusher;
  const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'mt1';
  const host = import.meta.env.VITE_PUSHER_HOST ?? undefined;
  const scheme = import.meta.env.VITE_PUSHER_SCHEME ?? 'https';
  const forceTLS = scheme === 'https';

  window.Echo = new Echo({
    broadcaster: 'pusher',
    key,
    cluster,
    wsHost: host || `ws-${cluster}.pusher.com`,
    wsPort: Number(import.meta.env.VITE_PUSHER_PORT ?? (forceTLS ? 443 : 80)),
    wssPort: Number(import.meta.env.VITE_PUSHER_PORT ?? 443),
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
  });

  return window.Echo;
};

export const useSmsRealtime = ({ threadId, onMessage, onThreadUpdated }: SmsRealtimeOptions) => {
  useEffect(() => {
    let isMounted = true;
    let threadChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;
    let listChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;

    const bindHandlers = async () => {
      const echo = await getEcho();
      if (!echo || !isMounted) return;

      listChannel = echo.private('sms.thread-list');
      listChannel
        .listen('.SmsThreadUpdated', (event: { thread: SmsThreadSummary }) => {
          onThreadUpdated?.(event.thread);
        })
        .listen('.SmsMessageReceived', (event: { message: SmsMessageDetail; threadId: string }) => {
          if (!threadId || event.threadId !== String(threadId)) {
            onThreadUpdated?.({ id: event.threadId } as SmsThreadSummary);
          }
        })
        .listen('.SmsMessageSent', (event: { message: SmsMessageDetail; threadId: string }) => {
          if (!threadId || event.threadId !== String(threadId)) {
            onThreadUpdated?.({ id: event.threadId } as SmsThreadSummary);
          }
        });

      if (threadId) {
        threadChannel = echo.private(`sms.thread.${threadId}`);
        threadChannel
          .listen('.SmsMessageReceived', (event: { message: SmsMessageDetail }) => {
            onMessage?.(event.message);
          })
          .listen('.SmsMessageSent', (event: { message: SmsMessageDetail }) => {
            onMessage?.(event.message);
          });
      }
    };

    bindHandlers();

    return () => {
      isMounted = false;
      threadChannel?.stopListening('.SmsMessageReceived');
      threadChannel?.stopListening('.SmsMessageSent');
      threadChannel?.unsubscribe();
      listChannel?.stopListening('.SmsThreadUpdated');
      listChannel?.stopListening('.SmsMessageReceived');
      listChannel?.stopListening('.SmsMessageSent');
      listChannel?.unsubscribe();
    };
  }, [threadId, onMessage, onThreadUpdated]);
};

