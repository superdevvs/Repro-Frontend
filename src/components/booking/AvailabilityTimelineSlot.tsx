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
};

/**
 * Desktop (fine pointer + hover): Radix Tooltip on hover.
 * Touch / coarse / no-hover (iPad, phones): Popover toggled by tap;
 * outside tap dismisses. Parent click (photographer select) is stopped.
 */
export function AvailabilityTimelineSlot({
  className,
  style,
  label,
  content,
  children,
}: AvailabilityTimelineSlotProps) {
  const canHover = useMediaQuery(HOVER_CAPABLE_QUERY);
  const [open, setOpen] = React.useState(false);

  const barClassName = cn(
    'inline-flex items-center justify-center overflow-hidden',
    !canHover && 'cursor-pointer touch-manipulation',
    className,
  );

  // stopPropagation only — do not preventDefault, or Radix PopoverTrigger
  // will skip its toggle (composeEventHandlers checks defaultPrevented).
  const stopParentSelect = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  if (canHover) {
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
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="z-[200] w-auto max-w-[260px] whitespace-nowrap px-2 py-1 text-xs"
        onClick={stopParentSelect}
        onPointerDown={stopParentSelect}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
