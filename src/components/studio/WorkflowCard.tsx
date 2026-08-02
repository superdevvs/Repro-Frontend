import { useState } from 'react';
import { ArrowRight, Ban, CheckCircle2, ImageIcon, Video } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { WorkflowAvailability, WorkflowGalleryItem } from './workflowGalleryLogic';

/**
 * WorkflowCard (ai-editing-studio-revamp, task 13.1).
 *
 * One Workflow_Card: preview image, Workflow title, supported media type,
 * concise outcome description, availability state, and a launch control
 * (Req 5.2). The preview renders the stored application asset when one is
 * assigned and a media-type placeholder otherwise, in an aspect-ratio-reserved
 * frame so the grid never reflows while images load (Req 5.8, 11.8).
 *
 * Hover changes only colour, shadow, and the image transform inside an
 * `overflow-hidden` frame, so an enabled card gets a distinct hover state
 * without moving adjacent content (Req 5.6). Unavailable cards are not
 * launchable and display the server-provided reason (Req 5.9).
 */
export interface WorkflowCardProps {
  item: WorkflowGalleryItem;
  availability: WorkflowAvailability;
  /** Stored application asset path; `null` renders the placeholder. */
  previewImage?: string | null;
  onLaunch: (item: WorkflowGalleryItem) => void;
  compact?: boolean;
  className?: string;
}

export function WorkflowCard({
  item,
  availability,
  previewImage = null,
  onLaunch,
  compact = false,
  className,
}: WorkflowCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = item.icon;
  const MediaIcon = item.mediaType === 'video' ? Video : ImageIcon;
  const showImage = Boolean(previewImage) && !imageFailed;
  const reasonId = `workflow-card-reason-${item.id}`;

  return (
    <Card
      data-workflow-card={item.id}
      data-available={availability.available ? 'true' : 'false'}
      className={cn(
        'group flex h-full flex-col overflow-hidden',
        // Hover/focus affect colour and shadow only — no size, spacing, or
        // position changes, so adjacent cards never move (Req 5.6).
        'border-border/70 transition-colors duration-200 motion-reduce:transition-none',
        availability.available &&
          'hover:border-primary/60 hover:bg-muted/30 hover:shadow-lg focus-within:border-primary/60',
        !availability.available && 'opacity-90',
        className,
      )}
    >
      <div className={cn('relative w-full shrink-0 overflow-hidden bg-muted', compact ? 'aspect-[16/9]' : 'aspect-[16/10]')}>
        {showImage ? (
          <img
            src={previewImage ?? undefined}
            alt={item.previewAlt}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/40 text-muted-foreground"
            role="img"
            aria-label={`${item.previewAlt} (preview image not available yet)`}
          >
            <Icon className="h-7 w-7" aria-hidden="true" />
            <span className="text-xs font-medium">Preview coming soon</span>
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute left-3 top-3 gap-1 bg-background/90 backdrop-blur"
        >
          <MediaIcon className="h-3 w-3" aria-hidden="true" />
          <span>{item.mediaTypeLabel}</span>
        </Badge>
      </div>

      <div className={cn('flex flex-1 flex-col gap-3', compact ? 'p-3' : 'p-5')}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-tight">{item.title}</h3>
          {availability.available ? (
            <Badge variant="outline" className="gap-1 shrink-0 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span>Available</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 shrink-0 text-destructive">
              <Ban className="h-3 w-3" aria-hidden="true" />
              <span>Unavailable</span>
            </Badge>
          )}
        </div>

        <p className={cn('text-sm text-muted-foreground', compact && 'line-clamp-2 text-xs leading-5')}>{item.description}</p>

        {!availability.available && availability.reason ? (
          <p id={reasonId} className="text-xs text-destructive">
            {availability.reason}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-2">
          {compact ? <span className="text-[11px] text-muted-foreground">Open workflow</span> : null}
          <Button
            type="button"
            onClick={() => onLaunch(item)}
            disabled={!availability.available}
            aria-disabled={!availability.available}
            aria-describedby={!availability.available ? reasonId : undefined}
            aria-label={`Start ${item.title}`}
            size={compact ? 'icon' : 'default'}
            variant={compact ? 'ghost' : 'default'}
            className={compact ? 'h-8 w-8' : undefined}
          >
            {compact ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : 'Start'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default WorkflowCard;
