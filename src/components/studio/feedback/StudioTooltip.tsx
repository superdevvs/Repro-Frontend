import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * StudioTooltip — shared tooltip for Studio controls (ai-editing-studio-revamp,
 * task 16.4).
 *
 * The tooltip opens on pointer hover **and** on keyboard focus with identical
 * content (Req 12.2, 12.3). The content element stays mounted with
 * `role="tooltip"` and is wired to the trigger through `aria-describedby`, so a
 * disabled or icon-only control always exposes equivalent text — assistive
 * technology never depends on the hover state to reach it.
 *
 * Disabled controls should use `aria-disabled` (see `controlAriaProps`) rather
 * than the native `disabled` attribute; native-disabled elements emit no pointer
 * or focus events, which would leave keyboard users without the tooltip.
 */

export type StudioTooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface StudioTooltipProps {
  /** Tooltip text. When empty, the trigger renders unchanged. */
  content: React.ReactNode;
  children: React.ReactNode;
  side?: StudioTooltipSide;
  /** Explicit id for the tooltip element (defaults to a generated id). */
  id?: string;
  className?: string;
  contentClassName?: string;
}

const SIDE_CLASSES: Record<StudioTooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

const hasTooltipContent = (content: React.ReactNode): boolean => {
  if (content === null || content === undefined || content === false) return false;
  if (typeof content === 'string') return content.trim().length > 0;

  return true;
};

const mergeDescribedBy = (existing: unknown, tooltipId: string): string =>
  [typeof existing === 'string' ? existing : '', tooltipId]
    .filter((value) => value.length > 0)
    .join(' ');

export function StudioTooltip({
  content,
  children,
  side = 'top',
  id,
  className,
  contentClassName,
}: StudioTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const generatedId = React.useId();
  const tooltipId = id ?? `studio-tooltip-${generatedId}`;

  if (!hasTooltipContent(content)) {
    return <>{children}</>;
  }

  const trigger = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement, {
        'aria-describedby': mergeDescribedBy(
          (children as React.ReactElement).props['aria-describedby'],
          tooltipId,
        ),
      })
    : children;

  return (
    <span
      className={cn('relative inline-flex', className)}
      data-studio-tooltip-root=""
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      <span
        role="tooltip"
        id={tooltipId}
        data-studio-tooltip=""
        data-state={open ? 'open' : 'closed'}
        className={
          open
            ? cn(
                'absolute z-50 w-max max-w-xs rounded-md border border-border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-md',
                SIDE_CLASSES[side],
                contentClassName,
              )
            : 'sr-only'
        }
      >
        {content}
      </span>
    </span>
  );
}

export default StudioTooltip;
