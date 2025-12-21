import type { SmsMessageDetail } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SmsMessageBubbleProps {
  message: SmsMessageDetail;
}

export const SmsMessageBubble = ({ message }: SmsMessageBubbleProps) => {
  const isOutbound = message.direction === 'OUTBOUND';
  const timestamp = message.sentAt ? format(new Date(message.sentAt), 'MMM d • h:mm a') : '';

  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2 shadow-sm',
          isOutbound ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        <p className="text-sm whitespace-pre-line">{message.body}</p>
        <p className={cn('mt-1 text-xs', isOutbound ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {isOutbound ? 'You • ' : 'Them • '}
          {timestamp}
        </p>
      </div>
    </div>
  );
};

