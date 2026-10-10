import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { NotificationItem } from '@/hooks/useNotifications';
import { buildNotificationTimeline, type NotificationGroup } from '@/utils/notificationGroups';
import { cn } from '@/lib/utils';

interface Props {
  group?: NotificationGroup;
  onClose: () => void;
  onRead: (ids: string[]) => void;
  onOpen: (event: NotificationItem) => void;
  formatDate: (date: string) => string;
}

export function NotificationTimelineDialog({ group, onClose, onRead, onOpen, formatDate }: Props) {
  const entries = group ? buildNotificationTimeline(group.events) : [];
  const attentionIds = new Set(group?.attention.map(event => event.id));
  const openEvent = (event: NotificationItem) => { onClose(); onOpen(event); };
  return <Dialog open={Boolean(group)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex w-[calc(100%-2rem)] max-w-xl max-h-[85dvh] flex-col overflow-hidden rounded-lg p-4 sm:p-6">
      <DialogHeader className="shrink-0 text-left pr-6">
        <DialogTitle className="break-words leading-snug">{group?.title}</DialogTitle>
        <DialogDescription>{group?.events.length ?? 0} recent events · Timeline from oldest to newest</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        {group && group.attention.length > 0 && <section aria-label="Pending actions" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
          <h3 className="text-sm font-medium">Needs attention</h3>
          {group.attention.map(event => <Button key={event.id} type="button" variant="link" className="h-auto max-w-full justify-start whitespace-normal px-0 text-left text-xs" onClick={() => openEvent(event)}>{event.title} · {formatDate(event.date)}</Button>)}
        </section>}
        <ol aria-label="Shoot event timeline" className="space-y-3 pl-2">
          {entries.map(entry => {
            const latest = entry.events[entry.events.length - 1];
            const isUnread = entry.events.some(event => !event.isRead);
            return <li key={entry.id} className={cn('relative border-l-2 pl-4 pb-1', isUnread ? 'border-primary' : 'border-border')}>
              <span aria-hidden="true" className={cn('absolute -left-[5px] top-1 h-2 w-2 rounded-full', isUnread ? 'bg-primary' : 'bg-muted-foreground')} />
              <div className="flex flex-wrap items-start justify-between gap-1">
                <p className="text-sm font-medium">{entry.title}</p>
                <time className="text-[10px] text-muted-foreground">{formatDate(latest.date)}</time>
              </div>
              <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{latest.message}</p>
              {entry.events.length > 1 && <details className="mt-1 text-xs">
                <summary className="cursor-pointer text-primary">Show {entry.events.length} individual updates</summary>
                <ul className="mt-2 space-y-2">{entry.events.map(event => <li key={event.id} className="break-words"><span className="text-muted-foreground">{formatDate(event.date)} · </span>{event.message}</li>)}</ul>
              </details>}
              <div className="mt-1 flex flex-wrap gap-2">
                {isUnread && <Button type="button" variant="link" className="h-7 px-0 text-xs" onClick={() => onRead(entry.events.map(event => event.id))}>Mark read</Button>}
                {attentionIds.has(latest.id) && <Button type="button" variant="link" className="h-7 px-0 text-xs" onClick={() => openEvent(latest)}>Review</Button>}
              </div>
            </li>;
          })}
        </ol>
      </div>
      {group && <div className="flex shrink-0 flex-wrap gap-2 border-t pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => openEvent({ ...group.latest, action: undefined, title: group.title })}>{group.shootId ? 'Open shoot' : 'Open'}</Button>
        {group.unreadCount > 0 && <Button type="button" size="sm" className="ml-auto" onClick={() => onRead(group.events.map(event => event.id))}>Mark {group.unreadCount} {group.unreadCount === 1 ? 'update' : 'updates'} read</Button>}
      </div>}
    </DialogContent>
  </Dialog>;
}
