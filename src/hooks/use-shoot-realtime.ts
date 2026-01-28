import { useEffect } from 'react';
import { getEchoClient, isRealtimeEnabled } from '@/realtime/echoClient';

export interface ShootActivityEvent {
  id: string;
  shootId: number;
  activityType: string;
  message: string;
  address?: string;
  clientName?: string;
  photographerName?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  userId?: number;
  timestamp: string;
}

export type UserRole = 'admin' | 'superadmin' | 'client' | 'photographer' | 'editor' | 'salesRep';

type ShootRealtimeOptions = {
  shootId?: number | null;
  userRole?: UserRole | string | null;
  userId?: string | number | null;
  onActivity?: (activity: ShootActivityEvent) => void;
};

/**
 * Get the appropriate notification channel name based on user role
 */
const getNotificationChannelForRole = (role: string | null | undefined, userId: string | number | null | undefined): string | null => {
  if (!role || !userId) return null;

  switch (role) {
    case 'admin':
    case 'superadmin':
      return 'admin.notifications';
    case 'client':
      return `client.${userId}.notifications`;
    case 'photographer':
      return `photographer.${userId}.notifications`;
    case 'editor':
      return `editor.${userId}.notifications`;
    default:
      // Sales reps and other roles don't have notification channels
      return null;
  }
};

export const useShootRealtime = ({ shootId, userRole, userId, onActivity }: ShootRealtimeOptions) => {
  useEffect(() => {
    let isMounted = true;
    let notificationChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;
    let shootChannel: ReturnType<NonNullable<typeof window.Echo>['private']> | null = null;

    const bindHandlers = async () => {
      if (!isRealtimeEnabled()) return;
      const echo = await getEchoClient();
      if (!echo || !isMounted) return;

      // Subscribe to the appropriate notification channel based on user role
      const channelName = getNotificationChannelForRole(userRole, userId);
      if (channelName) {
        notificationChannel = echo.private(channelName);
        notificationChannel.listen('.ShootActivity', (event: ShootActivityEvent) => {
          onActivity?.(event);
        });
      }

      // Optionally listen to a specific shoot channel (for shoot detail pages)
      if (shootId) {
        shootChannel = echo.private(`shoot.${shootId}`);
        shootChannel.listen('.ShootActivity', (event: ShootActivityEvent) => {
          onActivity?.(event);
        });
      }
    };

    bindHandlers();

    return () => {
      isMounted = false;
      notificationChannel?.stopListening('.ShootActivity');
      notificationChannel?.unsubscribe();
      shootChannel?.stopListening('.ShootActivity');
      shootChannel?.unsubscribe();
    };
  }, [shootId, userRole, userId, onActivity]);
};
