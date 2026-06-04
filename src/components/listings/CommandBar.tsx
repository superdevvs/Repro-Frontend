// CommandBar — the command-style search/filter/sort/saved-views bar for the
// Exclusive Listings Map Tab.
//
// This is a thin, composed UI renderer. It places, left-to-right in a single
// horizontal group (R4.1):
//   1. a search input with a categorized cmdk suggestions dropdown (R4.2)
//   2. the `FilterMenu` (R4.3)
//   3. the `SortMenu`  (R4.6)
//   4. the `SavedViewsMenu` (R4.7, R4.8)
//
// The parent supplies `suggestions` already computed by the hook's
// `buildSuggestions`; this component does NOT recompute them — it only groups
// them by category and renders them. cmdk's internal filtering is therefore
// disabled (`shouldFilter={false}`) so every provided suggestion is shown.

import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { FilterMenu } from './FilterMenu'
import { SortMenu } from './SortMenu'
import { SavedViewsMenu } from './SavedViewsMenu'
import type {
  Filter,
  FilterKey,
  SavedView,
  SortOption,
  Suggestion,
  SuggestionCategory,
} from '@/lib/listing-presentation/types'

export interface CommandBarProps {
  /** Current search text; mirrors the input value. */
  searchQuery: string
  /** Called with the new value whenever the search text changes. */
  onSearchChange: (q: string) => void
  /** Suggestions already computed by the parent (NOT recomputed here). */
  suggestions: Suggestion[]
  /** Active filters, forwarded to `FilterMenu`. */
  filters: Filter[]
  onAddFilter: (f: Filter) => void
  onRemoveFilter: (key: FilterKey) => void
  /** Active sort option, forwarded to `SortMenu`. */
  sort: SortOption
  onSortChange: (s: SortOption) => void
  /** Saved views, forwarded to `SavedViewsMenu`. */
  savedViews: SavedView[]
  onApplyView: (id: string) => void
  onSaveView: (name: string) => void
  onDeleteView: (id: string) => void
  /** City names offered as city filters in `FilterMenu`. */
  cityOptions?: string[]
  className?: string
}

/**
 * The fixed display order for suggestion categories. Only categories that have
 * at least one suggestion are rendered as a `CommandGroup`.
 */
const CATEGORY_ORDER: SuggestionCategory[] = [
  'Address',
  'City',
  'State',
  'ZIP',
  'Client',
]

interface CategoryGroup {
  category: SuggestionCategory
  items: Suggestion[]
}

/**
 * Group the provided suggestions by category, preserving the canonical
 * category order and each category's internal suggestion order.
 */
function groupByCategory(suggestions: Suggestion[]): CategoryGroup[] {
  const buckets = new Map<SuggestionCategory, Suggestion[]>()
  for (const suggestion of suggestions) {
    const existing = buckets.get(suggestion.category)
    if (existing) {
      existing.push(suggestion)
    } else {
      buckets.set(suggestion.category, [suggestion])
    }
  }
  return CATEGORY_ORDER.filter((category) => buckets.has(category)).map(
    (category) => ({ category, items: buckets.get(category) as Suggestion[] }),
  )
}

export function CommandBar({
  searchQuery,
  onSearchChange,
  suggestions,
  filters,
  onAddFilter,
  onRemoveFilter,
  sort,
  onSortChange,
  savedViews,
  onApplyView,
  onSaveView,
  onDeleteView,
  cityOptions = [],
  className,
}: CommandBarProps) {
  // `open` tracks whether the input has focus; the dropdown only shows while
  // focused AND there is something worth showing (a query or suggestions).
  const [open, setOpen] = React.useState(false)

  const grouped = React.useMemo(
    () => groupByCategory(suggestions),
    [suggestions],
  )

  const showDropdown =
    open && (searchQuery.trim().length > 0 || suggestions.length > 0)

  // Selecting a suggestion sets the search query to its value and closes the
  // dropdown (R4.2).
  const handleSelect = React.useCallback(
    (suggestion: Suggestion) => {
      onSearchChange(suggestion.value)
      setOpen(false)
    },
    [onSearchChange],
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Search input + categorized cmdk suggestions dropdown. */}
      <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
        <Command
          shouldFilter={false}
          className="relative overflow-visible rounded-none bg-transparent"
        >
          <div className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              value={searchQuery}
              onValueChange={onSearchChange}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
              }}
              placeholder="Search address, city, client..."
              aria-label="Search listings"
              className="flex h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          {showDropdown && (
            <div
              // Prevent the input from blurring before a suggestion click
              // registers, so `onSelect` fires while the input keeps focus.
              onMouseDown={(event) => event.preventDefault()}
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md"
            >
              <CommandList className="max-h-72">
                <CommandEmpty>No results</CommandEmpty>
                {grouped.map(({ category, items }) => (
                  <CommandGroup key={category} heading={category}>
                    {items.map((suggestion) => {
                      const value = `${category}:${suggestion.listingId}:${suggestion.value}`
                      return (
                        <CommandItem
                          key={value}
                          value={value}
                          onSelect={() => handleSelect(suggestion)}
                          className="cursor-pointer"
                        >
                          <span className="truncate">{suggestion.value}</span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </div>
          )}
        </Command>
      </div>

      {/* Filter / sort / saved-views controls. */}
      <FilterMenu
        filters={filters}
        onAddFilter={onAddFilter}
        onRemoveFilter={onRemoveFilter}
        cityOptions={cityOptions}
      />
      <SortMenu sort={sort} onSortChange={onSortChange} />
      <SavedViewsMenu
        savedViews={savedViews}
        onApplyView={onApplyView}
        onSaveView={onSaveView}
        onDeleteView={onDeleteView}
      />
    </div>
  )
}

export default CommandBar
