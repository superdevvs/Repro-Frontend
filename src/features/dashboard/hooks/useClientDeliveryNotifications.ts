import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import { API_BASE_URL } from '@/config/env';
import { useShootRealtime } from '@/hooks/use-shoot-realtime';
import { getAuthToken } from '@/utils/authToken';

export interface ClientDeliveryNotification {
  id: number;
  shootId: number;
  address: string;
  deliveredAt: string | null;
  seenAt: string | null;
}

type DeliveryNotificationResponse = {
  data?: {
    unseen_count?: number;
    entries?: Array<{
      id?: number;
      shoot_id?: number;
      address?: string;
      delivered_at?: string | null;
      seen_at?: string | null;
    }>;
  };
};

export const useClientDeliveryNotifications = () => {
  const { role, session, user } = useAuth();
  const [entries, setEntries] = useState<ClientDeliveryNotification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (role !== 'client' || !user?.id) return;
    const token = getAuthToken(session?.accessToken);
    if (!token) return;

    const response = await fetch(`${API_BASE_URL}/api/client/delivery-notifications`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
    if (!response.ok) return;

    const payload = await response.json() as DeliveryNotificationResponse;
    const normalizedEntries = (payload.data?.entries ?? [])
      .filter((entry) => entry.id != null && entry.shoot_id != null)
      .map((entry) => ({
        id: Number(entry.id),
        shootId: Number(entry.shoot_id),
        address: entry.address || 'Delivered shoot',
        deliveredAt: entry.delivered_at ?? null,
        seenAt: entry.seen_at ?? null,
      }));
    setEntries(normalizedEntries);
    setUnseenCount(Number(payload.data?.unseen_count ?? 0));
  }, [role, session?.accessToken, user?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    });
    return () => controller.abort();
  }, [refresh]);

  const handleActivity = useCallback((activity: { activityType?: string }) => {
    if (activity.activityType === 'shoot_finalized_delivered') {
      void refresh();
    }
  }, [refresh]);

  useShootRealtime({
    userRole: role,
    userId: user?.id,
    onActivity: handleActivity,
  });

  const markSeen = useCallback(async (notificationId: number) => {
    const token = getAuthToken(session?.accessToken);
    if (!token) return false;

    const response = await fetch(
      `${API_BASE_URL}/api/client/delivery-notifications/${notificationId}/seen`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (!response.ok) return false;

    setEntries((current) => current.map((entry) =>
      entry.id === notificationId
        ? { ...entry, seenAt: entry.seenAt ?? new Date().toISOString() }
        : entry));
    setUnseenCount((current) => Math.max(0, current - 1));
    return true;
  }, [session?.accessToken]);

  return {
    entries,
    latestUnseen: entries.find((entry) => !entry.seenAt) ?? null,
    unseenCount,
    markSeen,
    refresh,
  };
};
