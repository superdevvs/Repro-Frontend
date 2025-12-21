import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { SmsThreadSummary } from '@/types/messaging';
import { format, isToday, isYesterday } from 'date-fns';

interface SmsThreadListItemProps {
  thread: SmsThreadSummary;
  active?: boolean;
  onSelect?: () => void;
}

export const SmsThreadListItem = ({ thread, active, onSelect }: SmsThreadListItemProps) => {
  const initials = thread.contact?.initials ?? thread.contact?.name?.slice(0, 2) ?? '??';
  const phone = thread.contact?.primaryNumber;
  const name = thread.contact?.name || phone || 'Unknown contact';

  const formattedTime = thread.lastMessageAt
    ? isToday(new Date(thread.lastMessageAt))
      ? format(new Date(thread.lastMessageAt), 'h:mm a')
      : isYesterday(new Date(thread.lastMessageAt))
      ? 'Yesterday'
      : format(new Date(thread.lastMessageAt), 'MMM d')
    : '';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full border-b border-border/70 px-4 py-3 text-left transition hover:bg-muted/60',
        active && 'bg-muted/60 shadow-inner',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold tracking-tight">{name}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{formattedTime}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{thread.lastMessageSnippet || 'No messages yet'}</p>
          <div className="mt-1 flex items-center gap-2">
            {thread.unread && <span className="h-2 w-2 rounded-full bg-primary" />}
            {thread.contact?.type && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {thread.contact.type}
              </Badge>
            )}
            {thread.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] capitalize">
                {tag}
              </Badge>
            ))}
            {thread.tags && thread.tags.length > 2 && (
              <Badge variant="secondary" className="text-[10px]">
                +{thread.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

