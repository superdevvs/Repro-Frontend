import { useState } from 'react';
import { CalendarDays, CircleDollarSign, ClipboardCheck, ImageUp, MessageSquare, PackageCheck, Pencil, SlidersHorizontal, UserRound, CircleAlert } from 'lucide-react';
import type { NotificationItem } from '@/hooks/useNotifications';
import { countNotificationCategories, type NotificationEventCategory } from '@/utils/notificationCategories';
import { cn } from '@/lib/utils';

const ICONS = {
  payment: CircleDollarSign, uploads: ImageUp, editing: Pencil, review: ClipboardCheck,
  delivery: PackageCheck, schedule: CalendarDays, requests: CircleAlert,
  messages: MessageSquare, account: UserRound, updates: SlidersHorizontal,
} satisfies Record<NotificationEventCategory, typeof Pencil>;

export function NotificationCategoryPills({ events }: { events: NotificationItem[] }) {
  const [expanded, setExpanded] = useState<NotificationEventCategory | null>(null);
  return <ul aria-label="Event categories" className="flex min-w-0 flex-wrap items-center gap-1.5">
    {countNotificationCategories(events).map(({ category, label, count, unreadCount }) => {
      const Icon = ICONS[category];
      const description = `${label}: ${count} ${count === 1 ? 'event' : 'events'}, ${unreadCount} unread`;
      return <li key={category} className="max-w-full">
        <button type="button" aria-label={description} aria-expanded={expanded === category}
          title={`${description}. Tap to expand or collapse.`}
          onClick={() => setExpanded(current => current === category ? null : category)}
          className={cn('group/pill inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[11px] leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            unreadCount ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground')}>
          <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span aria-hidden="true" className={cn('overflow-hidden whitespace-nowrap transition-[max-width] duration-200 motion-reduce:transition-none group-hover/pill:max-w-52 group-focus-visible/pill:max-w-52', expanded === category ? 'max-w-52' : 'max-w-0')}>
            {label}{unreadCount > 0 ? ` · ${unreadCount} new` : ''}
          </span>
          <span aria-hidden="true" className="shrink-0 font-medium tabular-nums">{count}</span>
        </button>
      </li>;
    })}
  </ul>;
}
