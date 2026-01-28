import { useEffect } from 'react';
import type { SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';
import { getEchoClient, isRealtimeEnabled } from '@/realtime/echoClient';

type SmsRealtimeOptions = {
  threadId?: string | null;
  onMessage?: (message: SmsMessageDetail) => void;
  onThreadUpdated?: (thread: SmsThreadSummary) => void;
};

export const useSmsRealtime = ({ threadId, onMessage, onThreadUpdated }: SmsRealtimeOptions) => {
  useEffect(() => {
    let isMounted = true;
    let threadChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;
    let listChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;

    const bindHandlers = async () => {
      if (!isRealtimeEnabled()) return;
      const echo = await getEchoClient();
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

