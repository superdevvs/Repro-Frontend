import * as React from 'react'
import { Crosshair, Maximize2, Square, Tag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface FloatingMapActionsProps {
  /** Recenter the map on the loaded mapped listings (R8.2). */
  onRecenter: () => void
  /** Toggle the draw-area mode (R8.1). */
  onToggleDrawArea: () => void
  /** Show or hide the price / short label on the markers (R8.3). */
  onToggleLabels: () => void
  /** Expand the map to fullscreen / restore it (R8.4). */
  onToggleFullscreen: () => void
  /** Reflects the current label-visibility state on the labels button. */
  showLabels?: boolean
  /** Reflects whether draw-area mode is currently active. */
  drawAreaActive?: boolean
  /** Reflects whether the map is currently in fullscreen. */
  isFullscreen?: boolean
  className?: string
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

const positionClasses: Record<
  NonNullable<FloatingMapActionsProps['position']>,
  string
> = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
}

interface ActionDef {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  active?: boolean
}

/**
 * FloatingMapActions renders exactly four tooltip icon buttons floating over the
 * map: Recenter map, Draw area, Toggle property labels, and Fullscreen map.
 *
 * No satellite/imagery action is rendered (R8.5).
 */
const FloatingMapActions = React.forwardRef<HTMLDivElement, FloatingMapActionsProps>(
  (
    {
      onRecenter,
      onToggleDrawArea,
      onToggleLabels,
      onToggleFullscreen,
      showLabels = false,
      drawAreaActive = false,
      isFullscreen = false,
      className,
      position = 'top-right',
    },
    ref
  ) => {
    const actions: ActionDef[] = [
      {
        key: 'recenter',
        label: 'Recenter map',
        icon: Crosshair,
        onClick: onRecenter,
      },
      {
        key: 'draw-area',
        label: 'Draw area',
        icon: Square,
        onClick: onToggleDrawArea,
        active: drawAreaActive,
      },
      {
        key: 'toggle-labels',
        label: 'Toggle property labels',
        icon: Tag,
        onClick: onToggleLabels,
        active: showLabels,
      },
      {
        key: 'fullscreen',
        label: 'Fullscreen map',
        icon: Maximize2,
        onClick: onToggleFullscreen,
        active: isFullscreen,
      },
    ]

    return (
      <TooltipProvider delayDuration={300}>
        <div
          ref={ref}
          className={cn(
            'absolute z-10 flex flex-col gap-1 rounded-xl border border-border bg-background/80 p-1 shadow-md backdrop-blur-sm',
            positionClasses[position],
            className
          )}
        >
          {actions.map(({ key, label, icon: Icon, onClick, active }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={active ? 'accent' : 'ghost'}
                  size="icon"
                  className="h-9 w-9"
                  aria-label={label}
                  aria-pressed={active}
                  onClick={onClick}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    )
  }
)
FloatingMapActions.displayName = 'FloatingMapActions'

export { FloatingMapActions }
export default FloatingMapActions
