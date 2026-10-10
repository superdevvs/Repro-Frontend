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
import { countUnreadGroups, isAttentionNotification } from '@/utils/notificationGroups';
import {
  canAccessNotificationSms,
  normalizeNotificationRole,
} from '@/utils/notificationRole';
import {
  getReadIds,
  isNotificationRead,
  loadReadState,
  mergeNotificationLists,
  saveLastSeenAt,
  saveReadIds,
  seedLastSeenAt,
} from '@/utils/notificationReadState';

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
  metadata?: Record<string, unknown>;
  address?: string;
  isOwnAction?: boolean;
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
const getStorageKey = (options: {
  userId?: string | number;
  role?: string | null;
  isImpersonating?: boolean;
  originalUserId?: string | number | null;
}): string => {
  const roleKey = normalizeNotificationRole(options.role) || 'unknown';
  const userKey = options.userId ? String(options.userId) : 'anonymous';
  const impersonationKey =
    options.isImpersonating && options.originalUserId
      ? `_imp_${String(options.originalUserId)}`
      : options.isImpersonating
        ? '_impersonating'
        : '';

  return `${STORAGE_KEY_PREFIX}${roleKey}_${userKey}${impersonationKey}`;
};

const feedIdsFrom = (items: Array<{ id: string }>): Set<string> =>
  new Set(items.map((item) => item.id));

const persistReadReceipts = (ids: Set<string>, storageKey: string, currentFeedIds: Set<string>) => {
  saveReadIds(ids, storageKey, { currentFeedIds });
};

const SHOOT_ACTIVITY_TITLES: Record<string, string> = {
  account_created: 'New Account Registered',
  email_verification_requested: 'Email Verification Pending',
  shoot_assignment_review: 'Booking Needs Review',
  email_bounced: 'Email Bounced',
  email_delivery_risky: 'Email Delivery Warning',
  email_corrected_after_bounce: 'Email Updated',
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
  shoot_submitted_for_editing_review: 'Submitted for Review',
  shoot_submitted_edited: 'Edited Files Submitted',
  shoot_submitted_raw: 'Raw Files Submitted',
  payment_done: 'Payment Received',
  payment_marked_paid: 'Payment Marked Paid',
  payment_received: 'Payment Received',
  payment_completed: 'Payment Received',
  payment_failed: 'Payment Failed',
  payment_refunded: 'Payment Refunded',
  invoice_created: 'Invoice Created',
  invoice_sent: 'Invoice Sent',
  media_uploaded: 'Media Uploaded',
  upload_failed: 'Upload Failed',
  media_upload_failed: 'Upload Failed',
  cancellation_requested: 'Cancellation Requested',
  cancellation_approved: 'Cancellation Approved',
  cancellation_rejected: 'Cancellation Rejected',
  shoot_rescheduled: 'Shoot Rescheduled',
  shoot_updated: 'Shoot Updated',
  photographer_assigned: 'Photographer Assigned',
  editor_assigned: 'Editor Assigned',
  shoot_delivered: 'Shoot Delivered',
  email_received: 'Email Received',
  email_sent: 'Email Sent',
  internal_message_received: 'New Dashboard Message',
};

const SYSTEM_NOTIFICATION_ACTIONS = new Set([
  'account_created',
  'email_verification_requested',
  'email_bounced',
  'email_delivery_risky',
  'email_corrected_after_bounce',
]);

/**
 * Derive a human-readable title from the activity message when no action mapping exists.
 * Capitalizes the first letter and truncates to a reasonable length.
 */
const titleFromMessage = (message: string): string => {
  if (!message) return 'Activity';
  // Capitalize first letter, take first sentence or first ~40 chars
  const cleaned = message.charAt(0).toUpperCase() + message.slice(1);
  const firstSentence = cleaned.split(/[.!]\s/)[0];
  return firstSentence.length > 50 ? firstSentence.slice(0, 47) + '…' : firstSentence;
};

const normalizeActivity = (
  activity: DashboardActivityItem,
  readIds: Set<string>,
  lastSeenAt: number | null,
): NotificationItem => {
  const typeHint = (activity.type || '').toLowerCase();
  const actionHint = (activity.action || '').toLowerCase();
  
  let type: NotificationCategory = 'system';
  if (SYSTEM_NOTIFICATION_ACTIONS.has(actionHint)) {
    type = 'system';
  } else if (typeHint.includes('message') || actionHint.includes('sms') || actionHint.includes('email')) {
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

  // Generate a better title based on activity type — never fall back to generic "Dashboard activity"
  const activityType = activity.action || typeHint;
  const title = SHOOT_ACTIVITY_TITLES[activityType]
    || titleFromMessage(activity.message)
    || (activity.userName ? `${activity.userName} update` : 'Activity');

  const id = String(activity.id);

  return {
    id,
    title,
    message: activity.message,
    type,
    isRead: Boolean(activity.isOwnAction && !actionHint.endsWith('_failed')) || isNotificationRead(id, activity.timestamp, readIds, lastSeenAt),
    date: activity.timestamp || new Date().toISOString(),
    actionUrl: activity.shootId ? `/shoots/${activity.shootId}` : activity.actionUrl || undefined,
    actionLabel: activity.shootId ? 'View' : activity.actionLabel || undefined,
    shootId: activity.shootId ?? undefined,
    action: activity.action || undefined,
    metadata: activity.metadata,
    address: activity.address || undefined,
    isOwnAction: activity.isOwnAction,
  };
};

const buildSmsNotification = (
  payload: SmsMessageDetail | SmsThreadSummary,
  opts: { isMessage: boolean },
  readIds: Set<string>,
  lastSeenAt: number | null,
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
    isRead: isNotificationRead(id, now, readIds, lastSeenAt),
    date: now,
    actionUrl: threadId ? `/messaging/sms?thread=${encodeURIComponent(String(threadId))}` : undefined,
    actionLabel: 'Open thread',
    metadata: { thread_id: `sms:${threadId}` },
  };
};

const buildEmailNotification = (
  event: EmailRealtimeMessage,
  readIds: Set<string>,
  lastSeenAt: number | null,
): NotificationItem => {
  const isInbound = event.direction === 'INBOUND';
  const isInternal = event.provider === 'INTERNAL';
  const id = `email-${event.id}`;

  const title = isInternal
    ? 'New Dashboard Message'
    : isInbound
      ? 'New Email Received'
      : 'Email Sent';
  const senderName = event.sender_display_name || event.from_address;
  const subjectPreview = event.subject ? event.subject.substring(0, 50) : '(No Subject)';
  const bodyPreview = event.body_text?.trim().substring(0, 90);
  const date = event.created_at || new Date().toISOString();
  
  return {
    id,
    title,
    message: isInternal
      ? `From ${senderName}: ${bodyPreview || subjectPreview}`
      : isInbound
        ? `From ${senderName}: ${subjectPreview}`
        : `To ${event.to_address}: ${subjectPreview}`,
    type: 'messages',
    isRead: isNotificationRead(id, event.created_at, readIds, lastSeenAt),
    date,
    actionUrl: isInternal ? `/messaging/email/inbox?message=${event.id}` : '/messaging/email/inbox',
    actionLabel: isInternal ? 'View message' : 'View Email',
    metadata: { thread_id: event.thread_id },
  };
};

const buildShootActivityNotification = (
  event: ShootActivityEvent,
  readIds: Set<string>,
  lastSeenAt: number | null,
): NotificationItem => {
  const title = SHOOT_ACTIVITY_TITLES[event.activityType] || 'Shoot Update';
  const addressInfo = event.address ? ` at ${event.address}` : '';
  const clientInfo = event.clientName ? ` (${event.clientName})` : '';
  const normalizedId = String(event.id).startsWith('sa-') ? String(event.id) : `sa-${event.id}`;
  
  return {
    id: normalizedId,
    title,
    message: `${event.message}${addressInfo}${clientInfo}`,
    type: 'shoots',
    isRead: isNotificationRead(normalizedId, event.timestamp, readIds, lastSeenAt),
    date: event.timestamp,
    actionUrl: event.shootId ? `/shoots/${event.shootId}` : undefined,
    actionLabel: 'View Shoot',
    shootId: event.shootId,
    action: event.activityType,
    address: event.address,
    metadata: event.metadata,
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
): Promise<{ activityLog: DashboardActivityItem[]; readState?: { lastSeenAt: number | null; readIds: Record<string, number> } }> => {
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
  return { activityLog: json.data?.activity_log || [], readState: json.data?.read_state };
};

const EMPTY_ACTIVITY: DashboardActivityItem[] = [];

// Polling interval increased from 30s to 60s
const POLL_INTERVAL = 60000;

export const useNotifications = () => {
  const { session, user, role, isImpersonating, originalUser } = useAuth();
  
  // Track read IDs per user
  const readIdsRef = useRef<Set<string>>(new Set());
  const lastSeenAtRef = useRef<number | null>(null);
  const storageKey = useMemo(
    () =>
      getStorageKey({
        userId: user?.id,
        role,
        isImpersonating,
        originalUserId: originalUser?.id,
      }),
    [isImpersonating, originalUser?.id, role, user?.id],
  );
  const notificationContextKey = useMemo(
    () => `${storageKey}:${String(user?.id ?? 'anonymous')}`,
    [storageKey, user?.id],
  );

  // Reset local notification state when the effective notification context changes.
  useEffect(() => {
    const stored = loadReadState(storageKey);
    readIdsRef.current = new Set(Object.keys(stored.readIds));
    lastSeenAtRef.current = stored.lastSeenAt;
    previousActivityLogRef.current = '';
    setNotifications([]);
    setReadSyncError(null);
  }, [notificationContextKey, storageKey]);

  // Use React Query for fetching notifications with smart polling
  const {
    data: feed,
    isLoading: loading,
    isFetched,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['notifications', storageKey, role, user?.id, originalUser?.id, isImpersonating],
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
  const [readSyncError, setReadSyncError] = useState<string | null>(null);
  const previousActivityLogRef = useRef<string>('');
  const currentContextRef = useRef(notificationContextKey);
  currentContextRef.current = notificationContextKey;
  const activityLog = feed?.activityLog ?? EMPTY_ACTIVITY;

  const syncReadState = useCallback(async (ids: string[], watermark: number | null) => {
    const context = notificationContextKey;
    const token = getToken(isImpersonating ? null : session?.accessToken);
    if (!token) return;
    try {
      // Batched updates are additive on the server, including concurrent devices.
      const chunks = ids.length ? Array.from({ length: Math.ceil(ids.length / 1000) }, (_, i) => ids.slice(i * 1000, (i + 1) * 1000)) : [[]];
      for (const chunk of chunks) {
        if (currentContextRef.current !== context) return;
        const response = await fetch(`${API_BASE_URL}/api/notifications/read-state`, {
          method: 'POST',
          headers: {
            Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
            ...(isImpersonating ? { 'X-Impersonate-User-Id': String(user?.id) } : {}),
          },
          body: JSON.stringify({ ids: chunk, lastSeenAt: watermark }),
        });
        if (!response.ok) throw new Error('Read status could not sync');
        const { data } = await response.json();
        if (currentContextRef.current !== context) return;
        Object.keys(data?.readIds ?? {}).forEach(id => readIdsRef.current.add(id));
        if (typeof data?.lastSeenAt === 'number') lastSeenAtRef.current = Math.max(lastSeenAtRef.current ?? 0, data.lastSeenAt);
        setNotifications(prev => prev.map(item => ({ ...item, isRead: item.isRead || isNotificationRead(item.id, item.date, readIdsRef.current, lastSeenAtRef.current) })));
      }
      if (currentContextRef.current === context) setReadSyncError(null);
    } catch {
      if (currentContextRef.current === context) setReadSyncError('Read status is saved on this device. Sync is pending.');
    }
  }, [notificationContextKey, isImpersonating, session?.accessToken, user?.id]);

  const retryReadSync = useCallback(() => syncReadState([...readIdsRef.current], lastSeenAtRef.current), [syncReadState]);

  // Merge activity notifications with local state - only when activityLog actually changes
  useEffect(() => {
    if (!isFetched) {
      return;
    }

    // Create a stable key from activityLog to detect actual changes
    const activityLogKey = JSON.stringify([activityLog, feed?.readState]);
    
    // Only update if the activity log actually changed
    if (previousActivityLogRef.current === activityLogKey) {
      return;
    }
    
    previousActivityLogRef.current = activityLogKey;

    const now = Date.now();
    const remoteWatermark = feed?.readState?.lastSeenAt;
    const lastSeenAt = seedLastSeenAt(
      typeof remoteWatermark === 'number' ? Math.max(lastSeenAtRef.current ?? 0, remoteWatermark) : lastSeenAtRef.current,
      activityLog.map((item) => item.timestamp),
      now,
    );
    if (lastSeenAtRef.current !== lastSeenAt) {
      lastSeenAtRef.current = lastSeenAt;
      saveLastSeenAt(storageKey, lastSeenAt);
    }

    const feedIds = new Set(activityLog.map((item) => String(item.id)));
    readIdsRef.current = getReadIds(storageKey, feedIds, now);
    Object.keys(feed?.readState?.readIds ?? {}).forEach(id => readIdsRef.current.add(id));
    persistReadReceipts(readIdsRef.current, storageKey, feedIds);

    const activityNotifications = activityLog.map((item) =>
      normalizeActivity(item, readIdsRef.current, lastSeenAtRef.current),
    );

    setNotifications((prev) => mergeNotificationLists(prev, activityNotifications, now));
    // Migrate existing browser receipts once, then retry only when the server is missing local reads.
    if (feed?.readState && (remoteWatermark !== lastSeenAt || [...readIdsRef.current].some(id => feedIds.has(id) && !feed.readState?.readIds[id]))) {
      void syncReadState([...readIdsRef.current].filter(id => feedIds.has(id)), lastSeenAt);
    }
  }, [activityLog, feed?.readState, isFetched, storageKey, syncReadState]);

  const mergeNotifications = useCallback((incoming: NotificationItem[]) => {
    setNotifications((prev) => {
      const map = new Map<string, NotificationItem>();
      prev.forEach((item) => map.set(item.id, item));

      incoming.forEach((item) => {
        const existing = map.get(item.id);
        const isRead =
          existing?.isRead ||
          item.isRead ||
          isNotificationRead(item.id, item.date, readIdsRef.current, lastSeenAtRef.current);
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

  const markManyAsRead = useCallback((ids: string[]) => {
    ids.forEach(id => readIdsRef.current.add(id));
    setNotifications((prev) => {
      persistReadReceipts(readIdsRef.current, storageKey, feedIdsFrom(prev));
      return prev.map((notification) =>
        readIdsRef.current.has(notification.id) ? { ...notification, isRead: true } : notification,
      );
    });
    void syncReadState(ids, lastSeenAtRef.current);
  }, [storageKey, syncReadState]);

  const markAsRead = useCallback((id: string) => markManyAsRead([id]), [markManyAsRead]);

  const markAllAsRead = useCallback(() => {
    // Acknowledges the displayed snapshot, never an event arriving after this click.
    markManyAsRead(notifications.map(notification => notification.id));
  }, [notifications, markManyAsRead]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // SMS real-time events (only for admin/superadmin who can access messaging)
  const canAccessSms = canAccessNotificationSms(role);
  useSmsRealtime({
    onMessage: canAccessSms ? (message) => {
      addNotification(buildSmsNotification(message, { isMessage: true }, readIdsRef.current, lastSeenAtRef.current), { showToast: true });
    } : undefined,
    onThreadUpdated: canAccessSms ? (thread) => {
      addNotification(buildSmsNotification(thread, { isMessage: false }, readIdsRef.current, lastSeenAtRef.current));
    } : undefined,
  });

  // Email real-time events - all authenticated users can receive email notifications
  useEmailRealtime({
    onEmailReceived: (email) => {
      if (email.send_source === 'INTERNAL_MESSAGE_NOTIFICATION') return;
      if (email.sender_user_id && Number(email.sender_user_id) === Number(user?.id)) return;
      if (normalizeNotificationRole(role) === 'client' && email.provider !== 'INTERNAL') return;
      const notification = buildEmailNotification(email, readIdsRef.current, lastSeenAtRef.current);
      addNotification(notification, { showToast: true });
    },
    onEmailSent: (email) => {
      if (email.send_source === 'INTERNAL_MESSAGE_NOTIFICATION') return;
      if (email.sender_user_id && Number(email.sender_user_id) === Number(user?.id)) return;
      if (normalizeNotificationRole(role) === 'client' && email.provider !== 'INTERNAL') return;
      const notification = buildEmailNotification(email, readIdsRef.current, lastSeenAtRef.current);
      addNotification(notification, { showToast: email.provider === 'INTERNAL' });
    },
  });

  // Shoot activity real-time events - pass user role and id for channel subscription
  useShootRealtime({
    userRole: role,
    userId: user?.id,
    onActivity: (event) => {
      const notification = buildShootActivityNotification(event, readIdsRef.current, lastSeenAtRef.current);
      notification.isOwnAction = event.userId != null && Number(event.userId) === Number(user?.id);
      const quietOwnAction = notification.isOwnAction && !event.activityType.endsWith('_failed');
      notification.isRead ||= Boolean(quietOwnAction);
      addNotification(notification, { showToast: !quietOwnAction && isAttentionNotification(notification) });
    },
  });

  const unreadCount = useMemo(
    () => countUnreadGroups(notifications),
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
    markManyAsRead,
    markAllAsRead,
    readSyncError,
    retryReadSync,
  };
};
