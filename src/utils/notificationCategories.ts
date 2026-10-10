import type { NotificationItem } from '@/hooks/useNotifications';

export const NOTIFICATION_CATEGORY_LABELS = {
  payment: 'Payments', uploads: 'Uploads', editing: 'Editing', review: 'Review',
  delivery: 'Delivery', schedule: 'Scheduling', requests: 'Requests',
  messages: 'Messages', account: 'Account', updates: 'Updates',
} as const;

export type NotificationEventCategory = keyof typeof NOTIFICATION_CATEGORY_LABELS;

function categoryFor(event: NotificationItem): NotificationEventCategory {
  const action = (event.action ?? '').toLowerCase();
  // Use the persisted action before the title: "email delivery" is not shoot delivery.
  if (/payment|invoice|refund/.test(action)) return 'payment';
  if (/account|email_(verification|verified|bounced|delivery_risky|corrected)/.test(action)) return 'account';
  if (event.type === 'messages' || /email|sms|message|support|ticket/.test(action)) return 'messages';
  if (/review/.test(action)) return 'review';
  if (/upload|media|submitted_raw|submitted_edited/.test(action)) return 'uploads';
  if (/editing|editor/.test(action)) return 'editing';
  if (/deliver/.test(action)) return 'delivery';
  if (/request|hold|cancel|declin/.test(action)) return 'requests';
  if (/schedul|photographer_assigned|shoot_(created|approved|started|completed)/.test(action)) return 'schedule';
  if (action) return 'updates';
  // Older feed items may have only a title. Preserve a useful category for those.
  const title = event.title.toLowerCase();
  if (/payment|paid|invoice|refund/.test(title)) return 'payment';
  if (/upload|media|files/.test(title)) return 'uploads';
  if (/review/.test(title)) return 'review';
  if (/editing|editor/.test(title)) return 'editing';
  if (/deliver/.test(title)) return 'delivery';
  if (/request|hold|cancel|declin/.test(title)) return 'requests';
  if (/schedul|assigned|shoot (created|approved|started|completed)/.test(title)) return 'schedule';
  return event.type === 'system' ? 'account' : 'updates';
}

export interface NotificationCategoryCount {
  category: NotificationEventCategory;
  label: string;
  count: number;
  unreadCount: number;
}

export function countNotificationCategories(events: NotificationItem[]): NotificationCategoryCount[] {
  const counts = new Map<NotificationEventCategory, NotificationCategoryCount>();
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const category = categoryFor(event);
    const entry = counts.get(category) ?? { category, label: NOTIFICATION_CATEGORY_LABELS[category], count: 0, unreadCount: 0 };
    entry.count++;
    if (!event.isRead) entry.unreadCount++;
    counts.set(category, entry);
  }
  // Keep positions stable as a shoot moves through its workflow.
  return (Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationEventCategory[])
    .flatMap(category => counts.has(category) ? [counts.get(category)!] : []);
}
