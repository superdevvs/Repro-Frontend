import type { NotificationItem } from '@/hooks/useNotifications';
import { parseNotificationDate } from './notificationReadState';

export interface NotificationGroup {
  id: string;
  type: NotificationItem['type'];
  shootId?: number;
  title: string;
  latest: NotificationItem;
  events: NotificationItem[];
  unreadCount: number;
  attention: NotificationItem[];
}

const ATTENTION_RESOLUTIONS: Record<string, string[]> = {
  shoot_requested: ['shoot_approved', 'shoot_scheduled', 'shoot_declined', 'shoot_cancelled'],
  cancellation_requested: ['cancellation_approved', 'cancellation_rejected', 'shoot_cancelled'],
  hold_requested: ['hold_approved', 'hold_rejected', 'shoot_put_on_hold', 'shoot_resumed_from_hold'],
  shoot_assignment_review: ['photographer_assigned', 'shoot_scheduled', 'shoot_declined', 'shoot_cancelled'],
  shoot_submitted_for_review: ['shoot_delivered', 'shoot_finalized_delivered', 'shoot_editing_started', 'shoot_review_approved', 'shoot_review_rejected'],
  shoot_submitted_for_editing_review: ['shoot_delivered', 'shoot_finalized_delivered', 'shoot_editing_started', 'shoot_review_approved', 'shoot_review_rejected'],
  payment_failed: ['payment_received', 'payment_done', 'payment_completed', 'payment_marked_paid'],
  upload_failed: ['media_uploaded', 'shoot_submitted_raw', 'shoot_submitted_edited'],
  media_upload_failed: ['media_uploaded', 'shoot_submitted_raw', 'shoot_submitted_edited'],
  email_bounced: ['email_corrected_after_bounce'],
  email_delivery_risky: ['email_corrected_after_bounce'],
  email_verification_requested: ['email_verified'],
};

export const isAttentionNotification = (item: NotificationItem): boolean =>
  Boolean(ATTENTION_RESOLUTIONS[item.action ?? '']);

const keyFor = (item: NotificationItem): string => {
  // Group by identity, never by street address (units and repeat shoots can share one).
  if (item.type === 'shoots' && item.shootId) return `shoot:${item.shootId}`;
  if (item.type === 'messages' && item.metadata?.thread_id) return `thread:${item.metadata.thread_id}`;
  if (item.actionUrl?.includes('ticket=')) return `support:${item.actionUrl}`;
  if (item.type === 'system' && item.metadata?.user_id) return `account:${item.metadata.user_id}`;
  return `event:${item.id}`;
};

const newestFirst = (a: NotificationItem, b: NotificationItem): number => {
  const timestampDifference = (parseNotificationDate(b.date) ?? 0) - (parseNotificationDate(a.date) ?? 0);
  if (timestampDifference) return timestampDifference;
  // Persisted activities can share a second; their log IDs preserve event order.
  const aLog = /^(sa|email-issue|email)-(\d+)$/.exec(a.id);
  const bLog = /^(sa|email-issue|email)-(\d+)$/.exec(b.id);
  return aLog && bLog && aLog[1] === bLog[1] ? Number(bLog[2]) - Number(aLog[2]) : 0;
};

export function groupNotifications(items: NotificationItem[]): NotificationGroup[] {
  const groups = new Map<string, NotificationItem[]>();
  for (const item of items) {
    const key = keyFor(item);
    const events = groups.get(key) ?? [];
    if (!events.some(event => event.id === item.id)) events.push(item);
    groups.set(key, events);
  }
  return [...groups.entries()].map(([id, events]) => {
    events.sort(newestFirst);
    const latest = events[0];
    const attention = events.filter((event, index) => {
      const resolutions = ATTENTION_RESOLUTIONS[event.action ?? ''];
      if (!resolutions) return false;
      // Read receipts acknowledge an alert; only a later resolution removes it from attention.
      return !events.slice(0, index).some(newer => {
        if (!resolutions.includes(newer.action ?? '')) return false;
        const batch = event.metadata?.upload_batch_id;
        return !batch || newer.metadata?.upload_batch_id === batch;
      });
    });
    return {
      id, type: latest.type, shootId: latest.type === 'shoots' ? latest.shootId : undefined,
      title: latest.type === 'shoots' && latest.shootId
        ? events.find(event => event.address)?.address || `Shoot #${latest.shootId}`
        : latest.title,
      latest, events, unreadCount: events.filter(event => !event.isRead).length, attention,
    };
  }).sort((a, b) => newestFirst(a.latest, b.latest));
}

export const countUnreadGroups = (items: NotificationItem[]): number =>
  groupNotifications(items).filter(group => group.unreadCount > 0).length;

export interface NotificationTimelineEntry {
  id: string;
  title: string;
  events: NotificationItem[];
}

const BURST_ACTIONS = new Set(['media_uploaded', 'media_upload_initiated', 'shoot_updated', 'shoot_editing_started', 'editor_assigned']);

export function buildNotificationTimeline(events: NotificationItem[]): NotificationTimelineEntry[] {
  const entries: NotificationTimelineEntry[] = [];
  for (const event of [...events].sort((a, b) => newestFirst(b, a))) {
    const previous = entries.at(-1);
    const last = previous?.events.at(-1);
    const gap = (parseNotificationDate(event.date) ?? 0) - (parseNotificationDate(last?.date) ?? 0);
    if (previous && last && BURST_ACTIONS.has(event.action ?? '') && last.action === event.action
      && last.metadata?.by === event.metadata?.by && last.isRead === event.isRead && gap >= 0 && gap <= 5 * 60_000) {
      previous.events.push(event);
      const counts = new Map<string, number>();
      for (const item of previous.events) {
        const fileCount = Number(item.metadata?.file_count);
        if (!Number.isFinite(fileCount) || fileCount <= 0) continue;
        const batch = String(item.metadata?.upload_batch_id ?? item.id);
        counts.set(batch, Math.max(counts.get(batch) ?? 0, fileCount));
      }
      previous.title = event.action === 'media_uploaded' && previous.events.every(item => Number(item.metadata?.file_count) > 0)
        ? `${[...counts.values()].reduce((sum, count) => sum + count, 0)} files uploaded`
        : `${event.title} · ${previous.events.length} updates`;
    } else {
      entries.push({ id: event.id, title: event.title, events: [event] });
    }
  }
  return entries;
}
