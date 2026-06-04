// FilterChipBar — renders one removable chip per active filter for the
// Exclusive Listings Map Tab.
//
// This is a thin, presentational renderer over the pure `getFilterChips`
// helper, which is the single source of truth for chip identity and labels.
// Passing the raw `filters` (rather than precomputed chips) keeps
// `getFilterChips` as the only place chip derivation happens.
//
// Requirements:
//   - R4.4: one Filter_Chip per active filter.
//   - R4.5: activating a chip's remove control removes the corresponding filter.

import { X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getFilterChips } from '@/lib/listing-presentation/filters'
import type { Filter, FilterKey } from '@/lib/listing-presentation/types'

export interface FilterChipBarProps {
  /** The active filters; chips are derived via `getFilterChips`. */
  filters: Filter[]
  /** Called with the chip's stable key when its remove control is activated. */
  onRemoveFilter: (key: FilterKey) => void
  className?: string
}

/**
 * Renders a removable chip for each active filter. Returns `null` when there
 * are no active filters so the toolbar collapses cleanly.
 */
export function FilterChipBar({
  filters,
  onRemoveFilter,
  className,
}: FilterChipBarProps) {
  const chips = getFilterChips(filters)

  if (chips.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="outline"
          className="gap-1 rounded-full border-border bg-background py-1 pl-3 pr-1 text-foreground"
        >
          <span className="text-xs font-medium">{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemoveFilter(chip.key)}
            aria-label={`Remove ${chip.label} filter`}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

export default FilterChipBar
