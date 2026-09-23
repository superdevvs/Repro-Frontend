import type { ReactNode } from 'react';
import type { SmsMessageDetail } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

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
}

export const SmsMessageBubble = ({ message }: SmsMessageBubbleProps) => {
  const isOutbound = message.direction === 'OUTBOUND';
  const timestamp = message.sentAt ? format(new Date(message.sentAt), 'MMM d • h:mm a') : '';
  const senderLabel = isOutbound ? (message.aiGenerated ? 'Robbie' : 'You') : 'Them';

  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm lg:max-w-[80%] lg:px-4',
          isOutbound ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {message.aiGenerated && isOutbound && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            <Sparkles className="h-3 w-3" />
            Robbie AI
          </div>
        )}
        <p className="whitespace-pre-line text-base leading-snug lg:text-sm">
          <MessageText text={message.body ?? ''} />
        </p>
        <p className={cn('mt-1 text-xs', isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {senderLabel} • {timestamp}
        </p>
      </div>
    </div>
  );
};

