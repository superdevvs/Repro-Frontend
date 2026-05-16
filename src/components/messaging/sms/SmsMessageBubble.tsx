import type { SmsMessageDetail } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Sparkles } from 'lucide-react';

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
          'max-w-[80%] rounded-2xl px-4 py-2 shadow-sm',
          isOutbound ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {message.aiGenerated && isOutbound && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
            <Sparkles className="h-3 w-3" />
            Robbie AI
          </div>
        )}
        <p className="text-sm whitespace-pre-line">{message.body}</p>
        <p className={cn('mt-1 text-xs', isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {senderLabel} • {timestamp}
        </p>
      </div>
    </div>
  );
};

