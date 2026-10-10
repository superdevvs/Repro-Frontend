import { AlertCircle, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NotificationGroup } from '@/utils/notificationGroups';
import { cn } from '@/lib/utils';
import { NotificationCategoryPills } from './NotificationCategoryPills';

interface Props {
  group: NotificationGroup;
  formatDate: (date: string) => string;
  onTimeline: () => void;
  onOpen: () => void;
  onRead: () => void;
}

export function NotificationGroupCard({ group, formatDate, onTimeline, onOpen, onRead }: Props) {
  const attention = group.attention[0];
  return <article aria-label={group.title} className={cn('rounded-lg border p-3 space-y-2', group.unreadCount ? 'border-l-4 border-l-primary bg-card' : 'bg-muted/20')}>
    <div className="flex items-start justify-between gap-2">
      <h3 className="min-w-0 break-words text-sm font-semibold">{group.title}</h3>
      <span className="shrink-0 text-[10px] text-muted-foreground">{formatDate(group.latest.date)}</span>
    </div>
    {attention && <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Needs attention · {attention.title}{group.attention.length > 1 ? ` +${group.attention.length - 1}` : ''}</span>
    </div>}
    <p className="text-xs text-muted-foreground">Latest: {group.latest.title}</p>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <NotificationCategoryPills events={group.events} />
      <span className="text-muted-foreground">{group.events.length} {group.events.length === 1 ? 'event' : 'events'}</span>
    </div>
    <div className="flex flex-wrap items-center gap-1">
      <Button type="button" variant="link" size="sm" className="h-8 px-0 mr-2 text-xs" onClick={onTimeline} aria-label={`View timeline for ${group.title}`}>View timeline <ChevronRight className="h-3 w-3" /></Button>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onOpen}>{group.shootId ? 'Open shoot' : 'Open'}</Button>
      {group.unreadCount > 0 && <Button type="button" variant="ghost" size="icon" className="ml-auto h-8 w-8" onClick={onRead} aria-label={`Mark ${group.title} as read`} title="Mark as read"><Check className="h-3 w-3" /></Button>}
    </div>
  </article>;
}
