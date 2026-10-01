import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

const HOVER_CAPABLE_QUERY = '(hover: hover) and (pointer: fine)';

type AvailabilityTimelineSlotProps = {
  className?: string;
  style?: React.CSSProperties;
  label: string;
  content: React.ReactNode;
  children?: React.ReactNode;
  interaction?: 'adaptive' | 'popover';
  contentClassName?: string;
};

/**
 * Adaptive mode uses a tooltip for fine pointers with hover.
 * Booked details request a persistent popover on every device.
 * Touch / coarse / no-hover (iPad, phones): Popover toggled by tap;
 * outside tap dismisses. Parent click (photographer select) is stopped.
 */
export function AvailabilityTimelineSlot({
  className,
  style,
  label,
  content,
  children,
  interaction = 'adaptive',
  contentClassName,
}: AvailabilityTimelineSlotProps) {
  const canHover = useMediaQuery(HOVER_CAPABLE_QUERY);
  const usePopover = interaction === 'popover' || !canHover;
  const [open, setOpen] = React.useState(false);

  const barClassName = cn(
    'inline-flex items-center justify-center overflow-hidden',
    usePopover && 'cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white',
    className,
  );

  // stopPropagation only — do not preventDefault, or Radix PopoverTrigger
  // will skip its toggle (composeEventHandlers checks defaultPrevented).
  const stopParentSelect = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  if (!usePopover) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={barClassName} style={style}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] whitespace-nowrap px-2 py-1 text-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={label}
          className={barClassName}
          style={style}
          onClick={stopParentSelect}
          onPointerDown={stopParentSelect}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen(current => !current);
            }
          }}
          onKeyUp={stopParentSelect}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className={cn('z-[200] w-auto max-w-[calc(100vw-2rem)] whitespace-normal px-2 py-1 text-xs', contentClassName)}
        collisionPadding={16}
        aria-label={label}
        onClick={stopParentSelect}
        onPointerDown={stopParentSelect}
        onKeyDown={stopParentSelect}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
