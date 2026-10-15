import type { ReactNode } from 'react';
import type { SmsMessageDetail } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { parseSmsReaction, type SmsReactionBadge } from './smsReaction';

const URL_PATTERN = /https?:\/\/[^\s<>"'“”„‟«»‘’]+/g;

function MessageText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));

    let href = match[0];
    while (/[.,!?;:)]$/.test(href)) href = href.slice(0, -1);
    const trailing = match[0].slice(href.length);

    nodes.push(
      <a
        key={start}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 break-all"
      >
        {href}
      </a>,
    );
    if (trailing) nodes.push(trailing);
    last = start + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

interface SmsMessageBubbleProps {
  message: SmsMessageDetail;
  reactions?: SmsReactionBadge[];
}

export const SmsMessageBubble = ({ message, reactions = [] }: SmsMessageBubbleProps) => {
  const isOutbound = message.direction === 'OUTBOUND';
  const timestamp = message.sentAt ? format(new Date(message.sentAt), 'MMM d • h:mm a') : '';
  const senderLabel = isOutbound ? (message.aiGenerated ? 'Robbie' : 'You') : 'Them';
  const reaction = !isOutbound ? message.reaction ?? parseSmsReaction(message.body, message.direction) : null;
  const badges = reaction ? [{
    emoji: reaction.action === 'remove' ? `↩️ ${reaction.emoji}` : reaction.emoji,
    label: reaction.action === 'remove' ? `Removed ${reaction.label}` : reaction.label,
    sender: message.from || 'Contact',
    reactedAt: message.sentAt,
  }] : reactions;

  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className="flex max-w-[85%] flex-col lg:max-w-[80%]">
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 shadow-sm lg:px-4',
            isOutbound ? 'bg-primary text-primary-foreground' : 'bg-muted',
          )}
        >
          {message.aiGenerated && isOutbound && (
            <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              <Sparkles className="h-3 w-3" />
              Robbie AI
            </div>
          )}
          {reaction ? (
            <blockquote aria-label="Earlier message" className="whitespace-pre-line break-words border-l-2 border-current/20 pl-3 text-sm leading-snug">
              <MessageText text={reaction.quotedMessage} />
            </blockquote>
          ) : (
            <p className="whitespace-pre-line text-base leading-snug lg:text-sm">
              <MessageText text={message.body ?? ''} />
            </p>
          )}
          <p className={cn('mt-1 text-xs', isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {senderLabel} • {timestamp}
          </p>
        </div>
        {badges.length > 0 && (
          <div className="relative z-10 -mt-1.5 mr-2 flex max-w-full flex-wrap justify-end gap-1 self-end">
            {badges.map((badge) => {
              const description = `${badge.label} reaction from ${badge.sender}`;
              const time = badge.reactedAt ? format(new Date(badge.reactedAt), 'MMM d • h:mm a') : '';
              return <span key={badge.sender} role="img" aria-label={description} title={`${description}${time ? ` • ${time}` : ''}`}
                className="inline-flex min-h-7 min-w-8 items-center justify-center rounded-full border-2 border-background bg-muted px-2 py-0.5 text-base shadow-sm">
                {badge.emoji}
              </span>;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

