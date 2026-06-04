import React from 'react'
import { LayoutGrid, List, Map } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export type ViewMode = 'showcase' | 'grid' | 'list'

export interface ViewSwitcherProps {
  viewMode: ViewMode
  onChange: (mode: ViewMode) => void
  variant?: 'default' | 'overlay'
}

interface ViewOption {
  value: ViewMode
  label: string
  tooltip: string
  Icon: React.ComponentType<{ className?: string }>
}

// 'showcase' is the Map view (R6.1)
const VIEW_OPTIONS: ViewOption[] = [
  { value: 'showcase', label: 'Map view', tooltip: 'Map view', Icon: Map },
  { value: 'grid', label: 'Grid view', tooltip: 'Grid view', Icon: LayoutGrid },
  { value: 'list', label: 'List view', tooltip: 'List view', Icon: List },
]

/**
 * Segmented Map/Grid/List view switcher (R6).
 * Renders a single toggle-group with three items; the item matching `viewMode`
 * shows a strong blue active state (R6.2). Selecting an item calls `onChange`
 * with the corresponding value (R6.3), and each item exposes a hover tooltip
 * naming the view (R6.4).
 */
export function ViewSwitcher({
  viewMode,
  onChange,
  variant = 'default',
}: ViewSwitcherProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => {
          // Radix emits '' when an active item is re-clicked; ignore that so a
          // view mode is always selected (R6.3).
          if (value) {
            onChange(value as ViewMode)
          }
        }}
        variant="outline"
        size="sm"
        className={cn(
          'gap-0 rounded-lg border p-1 shadow-sm',
          variant === 'overlay'
            ? 'border-white/15 bg-slate-950/55'
            : 'border-border bg-background dark:bg-background',
        )}
        aria-label="View mode"
      >
        {VIEW_OPTIONS.map(({ value, label, tooltip, Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={value}
                aria-label={label}
                className={cn(
                  'h-9 w-9 rounded-lg border-0 text-muted-foreground transition-colors',
                  'hover:bg-muted hover:text-foreground',
                  'data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:shadow-sm',
                  'dark:data-[state=on]:bg-blue-500 dark:data-[state=on]:text-white',
                  variant === 'overlay' &&
                    'text-slate-300 hover:bg-slate-800 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  )
}

export default ViewSwitcher
