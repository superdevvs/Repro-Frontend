import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pause, Phone, UserRound } from 'lucide-react';
import type { SmsContact, SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';
import { SmsComposer } from './SmsComposer';
import { SmsMessageBubble } from './SmsMessageBubble';
import { format, formatDistanceToNow } from 'date-fns';
import { useEffect, useRef } from 'react';

interface SmsConversationProps {
  thread?: SmsThreadSummary;
  contact?: SmsContact;
  messages: SmsMessageDetail[];
  composerValue: string;
  onComposerChange: (value: string) => void;
  onSend: () => void;
  sending?: boolean;
  isMobile?: boolean;
  onBack?: () => void;
  onOpenContact?: () => void;
  templates?: Array<{ id: string | number; name: string; body_text?: string }>;
  onSelectTemplate?: (template: string) => void;
  onResumeAi?: () => void;
  resumingAi?: boolean;
  onToggleContactAi?: (enabled: boolean) => void;
  togglingContactAi?: boolean;
}

export const SmsConversation = ({
  thread,
  contact,
  messages,
  composerValue,
  onComposerChange,
  onSend,
  sending,
  isMobile,
  onBack,
  onOpenContact,
  templates,
  onSelectTemplate,
  onResumeAi,
  resumingAi,
  onToggleContactAi,
  togglingContactAi,
}: SmsConversationProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!thread) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <UserRound className="mx-auto mb-4 h-10 w-10 opacity-30" />
          <p>Select a conversation to get started.</p>
        </div>
      </div>
    );
  }

  const name = contact?.name || contact?.primaryNumber || 'Unknown contact';

  const grouped = messages.reduce<Array<{ date: string; items: SmsMessageDetail[] }>>((acc, message) => {
    const date = message.sentAt ? format(new Date(message.sentAt), 'PPP') : 'Unknown';
    const existing = acc.find((entry) => entry.date === date);
    if (existing) {
      existing.items.push(message);
    } else {
      acc.push({ date, items: [message] });
    }
    return acc;
  }, []);

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/70 p-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <p className="text-base font-semibold">{name}</p>
            <p className="text-xs text-muted-foreground">{contact?.email || contact?.primaryNumber}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {contact?.tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleContactAi && (
            <label className="hidden items-center gap-2 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground sm:flex">
              <input
                type="checkbox"
                checked={contact?.smsAiEnabled === true || thread.contactAiEnabled === true}
                disabled={togglingContactAi || contact?.smsOptOut === true || thread.contactOptedOut === true}
                onChange={(event) => onToggleContactAi(event.target.checked)}
              />
              AI replies enabled
            </label>
          )}
          {contact?.primaryNumber && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${contact.primaryNumber}`}>
                <Phone className="mr-2 h-4 w-4" />
                Call
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onOpenContact}>
            Details
          </Button>
        </div>
      </div>

      {thread.aiPausedUntil && new Date(thread.aiPausedUntil) > new Date() && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Pause className="h-3.5 w-3.5" />
            <span>
              {thread.aiRateLimitedAt ? 'AI rate-limited.' : 'AI replies paused.'}
              {' Resumes '}
              {formatDistanceToNow(new Date(thread.aiPausedUntil), { addSuffix: true })}.
            </span>
          </div>
          {onResumeAi && (
            <Button variant="outline" size="sm" onClick={onResumeAi} disabled={resumingAi}>
              {resumingAi ? 'Resuming…' : 'Resume AI'}
            </Button>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
        {grouped.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No messages yet. Start the conversation below.
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date} className="space-y-3">
              <div className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group.date}
              </div>
              {group.items.map((message) => (
                <SmsMessageBubble key={message.id} message={message} />
              ))}
            </div>
          ))
        )}
      </div>

      <SmsComposer
        value={composerValue}
        onChange={onComposerChange}
        onSend={onSend}
        disabled={sending || !composerValue.trim()}
        placeholder={`Write a message to ${name}`}
        templates={templates}
        onSelectTemplate={(text) => {
          onSelectTemplate?.(text);
        }}
      />
    </div>
  );
};

