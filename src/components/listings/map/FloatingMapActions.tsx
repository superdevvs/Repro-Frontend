import * as React from 'react'
import { Layers3, Maximize2, Minimize2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface FloatingMapActionsProps {
  onToggleCompactMode?: () => void
  compactMode?: boolean
  viewControls?: React.ReactNode
  /** Show or hide the price / short label on the markers (R8.3). */
  onToggleLabels: () => void
  /** Reflects the current label-visibility state on the labels button. */
  showLabels?: boolean
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
 * Shared map controls stay available while either map provider is loading.
 * One preview-size button switches between compact and expanded listing pins.
 */
const FloatingMapActions = React.forwardRef<HTMLDivElement, FloatingMapActionsProps>(
  (
    {
      onToggleCompactMode,
      compactMode = true,
      viewControls,
      onToggleLabels,
      showLabels = false,
      className,
      position = 'top-right',
    },
    ref
  ) => {
    const actions: ActionDef[] = [
      ...(onToggleCompactMode ? [{
        key: 'compact',
        label: compactMode ? 'Expand listing previews' : 'Shrink listing previews',
        icon: compactMode ? Maximize2 : Minimize2,
        onClick: onToggleCompactMode,
        active: !compactMode,
      }] : []),
      {
        key: 'toggle-labels',
        label: 'Toggle property labels',
        icon: Layers3,
        onClick: onToggleLabels,
        active: showLabels,
      },
    ]

    return (
      <TooltipProvider delayDuration={300}>
        <div
          ref={ref}
          role="group"
          aria-label="Map controls"
          data-testid="map-actions"
          className={cn(
            'absolute z-30 flex flex-col gap-1 rounded-xl border border-border bg-background/80 p-1 shadow-md backdrop-blur-sm',
            positionClasses[position],
            className
          )}
        >
          {viewControls ? <>
            {viewControls}
            <div className="mx-1 border-t border-border" aria-hidden="true" />
          </> : null}
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
              <TooltipContent side={position.endsWith('left') ? 'right' : 'left'}>{label}</TooltipContent>
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
