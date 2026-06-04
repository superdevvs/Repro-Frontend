import * as React from 'react'
import { Check, Filter as FilterIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { filterKey } from '@/lib/listing-presentation/filters'
import type { Filter, FilterKey } from '@/lib/listing-presentation/types'

export interface FilterMenuProps {
  /** Currently active filters. */
  filters: Filter[]
  /** Called when a filter is toggled on. */
  onAddFilter: (f: Filter) => void
  /** Called with the filter's stable key when a filter is toggled off. */
  onRemoveFilter: (key: FilterKey) => void
  /** Available city names to offer as city filters. */
  cityOptions?: string[]
}

interface FilterOption {
  /** The filter this option toggles. */
  filter: Filter
  /** Human-readable label shown in the menu. */
  label: string
}

/**
 * Builds the list of toggleable filter options: the fixed quick filters plus
 * one option per available city.
 */
function buildOptions(cityOptions: string[]): FilterOption[] {
  const base: FilterOption[] = [
    { filter: { kind: 'forSale' }, label: 'For Sale' },
    { filter: { kind: 'private' }, label: 'Private' },
    { filter: { kind: 'mapped' }, label: 'Mapped' },
    { filter: { kind: 'minBeds', value: 3 }, label: '3+ Beds' },
  ]

  const cities = cityOptions
    .filter((c) => typeof c === 'string' && c.trim().length > 0)
    .map<FilterOption>((city) => ({
      filter: { kind: 'city', value: city },
      label: city,
    }))

  return [...base, ...cities]
}

/**
 * FilterMenu renders a "Filters" trigger button that opens a popover of
 * toggleable filter options (For Sale, Private, Mapped, 3+ Beds, and one per
 * city). Each option reflects whether its filter is currently active; toggling
 * on calls `onAddFilter`, toggling off calls `onRemoveFilter(filterKey(f))`.
 */
export function FilterMenu({
  filters,
  onAddFilter,
  onRemoveFilter,
  cityOptions = [],
}: FilterMenuProps) {
  const activeKeys = React.useMemo(
    () => new Set(filters.map((f) => filterKey(f))),
    [filters],
  )

  const options = React.useMemo(
    () => buildOptions(cityOptions),
    [cityOptions],
  )

  const activeCount = activeKeys.size

  const toggle = (option: FilterOption, isActive: boolean) => {
    if (isActive) {
      onRemoveFilter(filterKey(option.filter))
    } else {
      onAddFilter(option.filter)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl border-border"
        >
          <FilterIcon className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 rounded-xl border-border p-1.5"
      >
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Filters
        </div>
        <div className="flex flex-col">
          {options.map((option) => {
            const key = filterKey(option.filter)
            const isActive = activeKeys.has(key)
            return (
              <button
                key={key}
                type="button"
                role="menuitemcheckbox"
                aria-checked={isActive}
                onClick={() => toggle(option, isActive)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'text-foreground',
                )}
              >
                <Checkbox
                  checked={isActive}
                  tabIndex={-1}
                  className="pointer-events-none"
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{option.label}</span>
                {isActive && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default FilterMenu
