import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, UserRound } from 'lucide-react';
import type { SmsContact, SmsMessageDetail, SmsThreadSummary } from '@/types/messaging';
import { SmsComposer } from './SmsComposer';
import { SmsMessageBubble } from './SmsMessageBubble';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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

