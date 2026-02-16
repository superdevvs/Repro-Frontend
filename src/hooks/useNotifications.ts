import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/components/auth/AuthProvider';
import type { DashboardActivityItem } from '@/types/dashboard';
import type { SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';
import { useSmsRealtime } from './use-sms-realtime';
import { useEmailRealtime, type EmailRealtimeMessage } from './use-email-realtime';
import { useShootRealtime, type ShootActivityEvent } from './use-shoot-realtime';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config/env';

export type NotificationCategory = 'shoots' | 'messages' | 'system';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationCategory;
  isRead: boolean;
  date: string;
  actionUrl?: string;
  actionLabel?: string;
  shootId?: number;
  action?: string;
}

const STORAGE_KEY_PREFIX = 'repro_read_notifications_';

const getToken = (sessionToken?: string | null) =>
  sessionToken ||
  (typeof window !== 'undefined' &&
    (localStorage.getItem('authToken') || localStorage.getItem('token'))) ||
  undefined;

/**
 * Get the user-specific storage key for read notifications
 */
const getStorageKey = (userId: string | number | undefined): string => {
  if (!userId) return `${STORAGE_KEY_PREFIX}anonymous`;
  return `${STORAGE_KEY_PREFIX}${userId}`;
};

/**
 * Get read notification IDs from localStorage for a specific user
 */
const getReadIds = (userId: string | number | undefined): Set<string> => {
  try {
    const storageKey = getStorageKey(userId);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only keep IDs from the last 7 days to prevent localStorage bloat
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const validEntries = Object.entries(parsed as Record<string, number>)
        .filter(([, timestamp]) => timestamp > cutoff);
      return new Set(validEntries.map(([id]) => id));
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
};

/**
 * Save read notification IDs to localStorage for a specific user
 */
const saveReadIds = (ids: Set<string>, userId: string | number | undefined) => {
  try {
    const storageKey = getStorageKey(userId);
    const now = Date.now();
    const stored: Record<string, number> = {};
    ids.forEach((id) => {
      stored[id] = now;
    });
    localStorage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // Ignore storage errors
  }
};

const SHOOT_ACTIVITY_TITLES: Record<string, string> = {
  shoot_requested: 'New Shoot Request',
  shoot_created: 'Shoot Created',
  shoot_approved: 'Shoot Approved',
  shoot_scheduled: 'Shoot Scheduled',
  shoot_started: 'Shoot Started',
  shoot_completed: 'Shoot Completed',
  shoot_cancelled: 'Shoot Cancelled',
  shoot_declined: 'Shoot Declined',
  shoot_put_on_hold: 'Shoot On Hold',
  hold_requested: 'Hold Requested',
  hold_approved: 'Hold Approved',
  hold_rejected: 'Hold Rejected',
  shoot_editing_started: 'Editing Started',
  shoot_submitted_for_review: 'Submitted for Review',
  payment_done: 'Payment Received',
  media_uploaded: 'Media Uploaded',
  cancellation_requested: 'Cancellation Requested',
  email_received: 'Email Received',
  email_sent: 'Email Sent',
};

const normalizeActivity = (activity: DashboardActivityItem, readIds: Set<string>): NotificationItem => {
  const typeHint = (activity.type || '').toLowerCase();
  const actionHint = (activity.action || '').toLowerCase();
  
  let type: NotificationCategory = 'system';
  if (typeHint.includes('message') || actionHint.includes('sms') || actionHint.includes('email')) {
    type = 'messages';
  } else if (
    typeHint.includes('shoot') ||
    actionHint.includes('shoot') ||
    typeHint.includes('request') ||
    typeHint.includes('payment') ||
    typeHint.includes('upload') ||
    typeHint.includes('review') ||
    typeHint.includes('editing')
  ) {
    type = 'shoots';
  }

  // Generate a better title based on activity type
  let title = 'Dashboard activity';
  if (activity.userName) {
    title = `${activity.userName} update`;
  }
  const activityType = activity.action || typeHint;
  if (SHOOT_ACTIVITY_TITLES[activityType]) {
    title = SHOOT_ACTIVITY_TITLES[activityType];
  }

  const id = String(activity.id);

  return {
    id,
    title,
    message: activity.message,
    type,
    isRead: readIds.has(id),
    date: activity.timestamp || new Date().toISOString(),
    actionUrl: activity.shootId ? `/shoots/${activity.shootId}` : undefined,
    actionLabel: activity.shootId ? 'View' : undefined,
    shootId: activity.shootId ?? undefined,
    action: activity.action || undefined,
  };
};

const buildSmsNotification = (
  payload: SmsMessageDetail | SmsThreadSummary,
  opts: { isMessage: boolean },
  readIds: Set<string>,
): NotificationItem => {
  const now = new Date().toISOString();
  const baseMessage =
    'body' in payload && payload.body
      ? payload.body
      : ('lastMessageSnippet' in payload && payload.lastMessageSnippet) || 'New SMS activity';

  const threadId = 'threadId' in payload ? payload.threadId : payload.id;
  const contactName =
    'contact' in payload && payload.contact?.name ? ` from ${payload.contact.name}` : '';

  const id = `sms-${threadId}-${now}`;

  return {
    id,
    title: opts.isMessage ? 'New SMS message' : 'SMS thread updated',
    message: `${baseMessage}${contactName}`,
    type: 'messages',
    isRead: readIds.has(id),
    date: now,
    actionUrl: threadId ? `/messaging/${threadId}` : undefined,
    actionLabel: 'Open thread',
  };
};

const buildEmailNotification = (event: EmailRealtimeMessage, readIds: Set<string>): NotificationItem => {
  const isInbound = event.direction === 'INBOUND';
  const now = new Date().toISOString();
  const id = `email-${event.id}-${now}`;
  
  const title = isInbound 
    ? 'New Email Received' 
    : 'Email Sent';
  const senderName = event.sender_display_name || event.from_address;
  const subjectPreview = event.subject ? event.subject.substring(0, 50) : '(No Subject)';
  
  return {
    id,
    title,
    message: isInbound 
      ? `From ${senderName}: ${subjectPreview}`
      : `To ${event.to_address}: ${subjectPreview}`,
    type: 'messages',
    isRead: readIds.has(id),
    date: event.created_at || now,
    actionUrl: '/messaging/email/inbox',
    actionLabel: 'View Email',
  };
};

const buildShootActivityNotification = (event: ShootActivityEvent, readIds: Set<string>): NotificationItem => {
  const title = SHOOT_ACTIVITY_TITLES[event.activityType] || 'Shoot Update';
  const addressInfo = event.address ? ` at ${event.address}` : '';
  const clientInfo = event.clientName ? ` (${event.clientName})` : '';
  
  return {
    id: event.id,
    title,
    message: `${event.message}${addressInfo}${clientInfo}`,
    type: 'shoots',
    isRead: readIds.has(event.id),
    date: event.timestamp,
    actionUrl: event.shootId ? `/shoots/${event.shootId}` : undefined,
    actionLabel: 'View Shoot',
    shootId: event.shootId,
    action: event.activityType,
  };
};

/**
 * Fetch notifications from the role-based notifications API endpoint
 * @param token - The auth token
 * @param impersonatedUserId - Optional user ID if impersonating
 */
const fetchNotifications = async (
  token: string,
  impersonatedUserId?: string | number | null
): Promise<DashboardActivityItem[]> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  
  // Add impersonation header if impersonating
  if (impersonatedUserId) {
    headers['X-Impersonate-User-Id'] = String(impersonatedUserId);
  }
  
  const res = await fetch(`${API_BASE_URL}/api/notifications`, { headers });

  if (!res.ok) {
    const message = res.status === 401
      ? 'Please log in to view notifications.'
      : `Failed to load notifications (${res.status})`;
    throw new Error(message);
  }

  const json = await res.json();
  return json.data?.activity_log || [];
};

// Polling interval increased from 30s to 60s
const POLL_INTERVAL = 60000;

export const useNotifications = () => {
  const { session, user, role, isImpersonating } = useAuth();
  
  // Track read IDs per user
  const readIdsRef = useRef<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | number | undefined>(undefined);

  // Update read IDs when user changes
  useEffect(() => {
    const newUserId = user?.id;
    if (currentUserIdRef.current !== newUserId) {
      currentUserIdRef.current = newUserId;
      readIdsRef.current = getReadIds(newUserId);
    }
  }, [user?.id]);

  // Use React Query for fetching notifications with smart polling
  const {
    data: activityLog = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['notifications', user?.id, isImpersonating ? user?.id : null],
    queryFn: async () => {
      const token = getToken(isImpersonating ? null : session?.accessToken);
      if (!token) throw new Error('Missing auth token');
      
      const impersonatedUserId = isImpersonating ? user?.id : null;
      return fetchNotifications(token, impersonatedUserId);
    },
    enabled: Boolean(user?.id),
    staleTime: 15 * 1000, // 15 seconds - notifications should be relatively fresh
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: (query) => {
      // Smart polling: pause when tab is not visible
      if (typeof document !== 'undefined' && document.hidden) {
        return false; // Don't poll when tab is hidden
      }
      // Poll every 60 seconds when tab is visible
      return POLL_INTERVAL;
    },
    refetchIntervalInBackground: false, // Don't poll in background
    retry: 1,
  });

  // Local state for notifications (includes real-time updates)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const previousActivityLogRef = useRef<string>('');

  // Merge activity notifications with local state - only when activityLog actually changes
  useEffect(() => {
    // Create a stable key from activityLog to detect actual changes
    const activityLogKey = JSON.stringify(activityLog.map(a => a.id));
    
    // Only update if the activity log actually changed
    if (previousActivityLogRef.current === activityLogKey) {
      return;
    }
    
    previousActivityLogRef.current = activityLogKey;
    
    // Convert activity log to notifications
    const activityNotifications = activityLog.map((a) => normalizeActivity(a, readIdsRef.current));
    
    setNotifications((prev) => {
      const map = new Map<string, NotificationItem>();
      prev.forEach((item) => map.set(item.id, item));

      activityNotifications.forEach((item) => {
        const existing = map.get(item.id);
        // Preserve read state from existing or from localStorage
        const isRead = existing?.isRead || readIdsRef.current.has(item.id);
        map.set(item.id, { ...item, isRead });
      });

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    });
  }, [activityLog]);

  const mergeNotifications = useCallback((incoming: NotificationItem[]) => {
    setNotifications((prev) => {
      const map = new Map<string, NotificationItem>();
      prev.forEach((item) => map.set(item.id, item));

      incoming.forEach((item) => {
        const existing = map.get(item.id);
        // Preserve read state from existing or from localStorage
        const isRead = existing?.isRead || readIdsRef.current.has(item.id);
        map.set(item.id, { ...item, isRead });
      });

      return Array.from(map.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    });
  }, []);

  const addNotification = useCallback(
    (notification: NotificationItem, options?: { showToast?: boolean }) => {
      mergeNotifications([notification]);
      if (options?.showToast) {
        toast({
          title: notification.title,
          description: notification.message,
        });
      }
    },
    [mergeNotifications],
  );

  const markAsRead = useCallback((id: string) => {
    // Update localStorage for current user
    readIdsRef.current.add(id);
    saveReadIds(readIdsRef.current, user?.id);
    
    // Update state
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
  }, [user?.id]);

  const markAllAsRead = useCallback(() => {
    // Update localStorage for current user
    setNotifications((prev) => {
      prev.forEach((n) => readIdsRef.current.add(n.id));
      saveReadIds(readIdsRef.current, user?.id);
      return prev.map((notification) => ({ ...notification, isRead: true }));
    });
  }, [user?.id]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // SMS real-time events (only for admin/superadmin who can access messaging)
  const canAccessSms = role === 'admin' || role === 'superadmin';
  useSmsRealtime({
    onMessage: canAccessSms ? (message) => {
      addNotification(buildSmsNotification(message, { isMessage: true }, readIdsRef.current), { showToast: true });
    } : undefined,
    onThreadUpdated: canAccessSms ? (thread) => {
      addNotification(buildSmsNotification(thread, { isMessage: false }, readIdsRef.current));
    } : undefined,
  });

  // Email real-time events - all authenticated users can receive email notifications
  useEmailRealtime({
    onEmailReceived: (email) => {
      const notification = buildEmailNotification(email, readIdsRef.current);
      addNotification(notification, { showToast: true });
    },
    onEmailSent: (email) => {
      const notification = buildEmailNotification(email, readIdsRef.current);
      addNotification(notification, { showToast: false }); // Don't toast for sent emails
    },
  });

  // Shoot activity real-time events - pass user role and id for channel subscription
  useShootRealtime({
    userRole: role,
    userId: user?.id,
    onActivity: (event) => {
      const notification = buildShootActivityNotification(event, readIdsRef.current);
      addNotification(notification, { showToast: true });
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    loading,
    error: queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load notifications') : null,
    refresh,
    addNotification,
    markAsRead,
    markAllAsRead,
  };
};
