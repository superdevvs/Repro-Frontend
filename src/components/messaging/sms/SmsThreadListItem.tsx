import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SmsThreadSummary } from '@/types/messaging';
import { format, isToday, isYesterday } from 'date-fns';
import { Pause, Sparkles } from 'lucide-react';
import { SmsThreadAvatar } from './SmsGroupAvatar';

interface SmsThreadListItemProps {
  thread: SmsThreadSummary;
  active?: boolean;
  onSelect?: () => void;
}

export const SmsThreadListItem = ({ thread, active, onSelect }: SmsThreadListItemProps) => {
  const phone = thread.group ? undefined : thread.contact?.primaryNumber;
  const name = thread.group?.name || thread.contact?.name || phone || 'Unknown contact';
  const aiPaused = thread.aiPausedUntil ? new Date(thread.aiPausedUntil) > new Date() : false;
  const isGroup = Boolean(thread.group);

  const formattedTime = thread.lastMessageAt
    ? isToday(new Date(thread.lastMessageAt))
      ? format(new Date(thread.lastMessageAt), 'h:mm a')
      : isYesterday(new Date(thread.lastMessageAt))
      ? 'Yesterday'
      : format(new Date(thread.lastMessageAt), 'MMM d')
    : '';

  const groupPeople = (thread.group?.members ?? []).map((member) => ({
    id: member.id,
    name: member.name,
    phone: member.phone,
  }));

  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={active ? 'true' : 'false'}
      className={cn(
        'min-h-[4.25rem] w-full border-b border-border/50 px-3 py-3 text-left transition-colors',
        'hover:bg-muted/50 active:bg-muted/70',
        // Google Messages–style light selection wash
        active && 'bg-primary/10 hover:bg-primary/15',
      )}
    >
      <div className="flex items-center gap-3">
        {isGroup ? (
          <SmsThreadAvatar
            mode="group"
            people={groupPeople}
            memberCount={thread.group?.memberCount ?? groupPeople.length}
          />
        ) : (
          <SmsThreadAvatar
            mode="direct"
            person={{
              id: thread.contact?.id,
              name: thread.contact?.name,
              phone: thread.contact?.primaryNumber,
              initials: thread.contact?.initials,
            }}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'truncate text-[15px] tracking-tight text-foreground',
                thread.unread ? 'font-bold' : 'font-semibold',
              )}
            >
              {name}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {formattedTime}
            </span>
          </div>
          <p
            className={cn(
              'mt-0.5 truncate text-sm leading-snug text-muted-foreground',
              thread.unread && 'font-medium text-foreground/80',
            )}
          >
            {thread.lastMessageSnippet || 'No messages yet'}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
            {thread.group ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wide">
                Group · {thread.group.memberCount}
              </Badge>
            ) : thread.contact?.type ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wide">
                {thread.contact.type}
              </Badge>
            ) : null}
            {thread.aiSessionId && !aiPaused && !thread.contactOptedOut && (
              <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] uppercase tracking-wide">
                <Sparkles className="h-3 w-3" />
                Robbie
              </Badge>
            )}
            {aiPaused && (
              <Badge variant="outline" className="h-5 gap-1 border-amber-300 px-1.5 text-[10px] uppercase tracking-wide text-amber-700">
                <Pause className="h-3 w-3" />
                AI paused
              </Badge>
            )}
            {thread.contactOptedOut && (
              <Badge variant="outline" className="h-5 border-red-300 px-1.5 text-[10px] uppercase tracking-wide text-red-700">
                Opted out
              </Badge>
            )}
            {thread.tags?.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="h-5 px-1.5 text-[10px] capitalize">
                {tag}
              </Badge>
            ))}
            {thread.tags && thread.tags.length > 2 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                +{thread.tags.length - 2}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};
