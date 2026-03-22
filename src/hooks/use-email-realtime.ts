import { useEffect } from 'react';
import { getEchoClient, isRealtimeEnabled } from '@/realtime/echoClient';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  canReceiveEmailInboxNotifications,
  canReceivePersonalEmailNotifications,
} from '@/utils/notificationRole';


export interface EmailRealtimeMessage {
  id: number;
  subject: string;
  from_address: string;
  to_address: string;
  sender_display_name: string | null;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  created_at: string;
  body_text: string;
}

type EmailRealtimeOptions = {
  onEmailReceived?: (message: EmailRealtimeMessage) => void;
  onEmailSent?: (message: EmailRealtimeMessage) => void;
};

export const useEmailRealtime = ({ onEmailReceived, onEmailSent }: EmailRealtimeOptions) => {
  const { user, role } = useAuth();

  useEffect(() => {
    let isMounted = true;
    let inboxChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;
    let userChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;

    const bindHandlers = async () => {
      if (!isRealtimeEnabled()) return;
      const echo = await getEchoClient();
      if (!echo || !isMounted) return;

      const shouldListenToInbox = canReceiveEmailInboxNotifications(role);
      const shouldListenToPersonal = canReceivePersonalEmailNotifications(role);

      if (shouldListenToInbox) {
        inboxChannel = echo.private('email.inbox');
        inboxChannel
          .listen('.EmailMessageReceived', (event: EmailRealtimeMessage) => {
            onEmailReceived?.(event);
          })
          .listen('.EmailMessageSent', (event: EmailRealtimeMessage) => {
            onEmailSent?.(event);
          });
      }

      if (shouldListenToPersonal && user?.id) {
        userChannel = echo.private(`email.user.${user.id}`);
        userChannel
          .listen('.EmailMessageReceived', (event: EmailRealtimeMessage) => {
            onEmailReceived?.(event);
          })
          .listen('.EmailMessageSent', (event: EmailRealtimeMessage) => {
            onEmailSent?.(event);
          });
      }
    };

    bindHandlers();

    return () => {
      isMounted = false;
      inboxChannel?.stopListening('.EmailMessageReceived');
      inboxChannel?.stopListening('.EmailMessageSent');
      inboxChannel?.unsubscribe();
      userChannel?.stopListening('.EmailMessageReceived');
      userChannel?.stopListening('.EmailMessageSent');
      userChannel?.unsubscribe();
    };
  }, [user?.id, role, onEmailReceived, onEmailSent]);
};
