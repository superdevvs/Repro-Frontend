import { FileText, RotateCw, X } from 'lucide-react';
import { InlineSpinner } from '@/components/ui/inline-spinner';
import { cn } from '@/lib/utils';
import { formatFileSize } from './smsAttachments';
import type { DraftAttachment } from './useSmsAttachmentDrafts';

interface SmsAttachmentTrayProps {
  items: DraftAttachment[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  disabled?: boolean;
}

const statusText = (item: DraftAttachment): string => {
  if (item.status === 'uploading') return `Uploading ${Math.round(item.progress * 100)}%`;
  if (item.status === 'scanning') return 'Checking for viruses…';
  if (item.status === 'ready') return formatFileSize(item.size);
  return item.error ?? 'Upload failed.';
};

export const SmsAttachmentTray = ({ items, onRemove, onRetry, disabled }: SmsAttachmentTrayProps) => {
  if (items.length === 0) return null;
  const problem = items.some(item => item.status === 'failed' || item.status === 'blocked');

  return (
    <div className="space-y-1.5">
      <ul aria-label="Attachments" className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
        {items.map(item => {
          const failed = item.status === 'failed' || item.status === 'blocked';
          const busy = item.status === 'uploading' || item.status === 'scanning';
          return (
            <li
              key={item.key}
              className={cn(
                'relative flex w-full max-w-[17rem] items-center gap-2.5 overflow-hidden rounded-lg border bg-muted/40 py-1.5 pl-1.5 pr-1 sm:w-auto sm:min-w-[12rem]',
                failed ? 'border-destructive/60' : 'border-border/70',
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background text-muted-foreground">
                {item.previewUrl
                  ? <img src={item.previewUrl} alt="" className={cn('h-full w-full object-cover', busy && 'opacity-60')} />
                  : <FileText className="h-4 w-4" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">{item.name}</span>
                <span
                  role={failed ? 'alert' : undefined}
                  className={cn('flex items-center gap-1 text-[11px] leading-tight', failed ? 'text-destructive' : 'text-muted-foreground')}
                >
                  {item.status === 'scanning' && <InlineSpinner aria-hidden className="h-3 w-3" />}
                  <span className={failed ? 'line-clamp-2' : 'truncate tabular-nums'} title={failed ? statusText(item) : undefined}>{statusText(item)}</span>
                </span>
              </span>
              {item.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => onRetry(item.key)}
                  disabled={disabled}
                  aria-label={`Retry ${item.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(item.key)}
                disabled={disabled}
                aria-label={`Remove ${item.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {item.status === 'uploading' && (
                <span
                  role="progressbar"
                  aria-label={`Uploading ${item.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(item.progress * 100)}
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-border/60"
                >
                  <span className="block h-full bg-primary transition-[width] duration-200 ease-out" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {problem
          ? 'Retry or remove the files marked in red before sending.'
          : 'The recipient gets a secure link to these files. It works for 30 days.'}
      </p>
    </div>
  );
};
