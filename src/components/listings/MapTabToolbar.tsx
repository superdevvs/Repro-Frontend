// The map overlay floats only the filtering/sorting controls and active chips.
// Map/Grid/List navigation belongs to the shared left-side map controls.

import * as React from 'react'
import { Building2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CommandBar } from './CommandBar'
import { ViewSwitcher } from './ViewSwitcher'
import { FilterChipBar } from './FilterChipBar'
import type {
  Filter,
  FilterKey,
  SavedView,
  SortOption,
  Suggestion,
} from '@/lib/listing-presentation/types'

export type MapTabViewMode = 'showcase' | 'grid' | 'list'

export interface MapTabToolbarProps {
  /** Number of listings represented by the current map result set. */
  totalListings: number
  // search
  searchQuery: string
  onSearchChange: (q: string) => void
  suggestions: Suggestion[]
  // filters
  filters: Filter[]
  onAddFilter: (f: Filter) => void
  onRemoveFilter: (key: FilterKey) => void
  cityOptions?: string[]
  // sort
  sort: SortOption
  onSortChange: (s: SortOption) => void
  // saved views
  savedViews: SavedView[]
  onApplyView: (id: string) => void
  onSaveView: (name: string) => void
  onDeleteView: (id: string) => void
  /** Set false when Saved views is promoted into the page header. */
  showSavedViews?: boolean
  // view mode
  viewMode: MapTabViewMode
  onViewModeChange: (mode: MapTabViewMode) => void
  className?: string
  variant?: 'default' | 'overlay'
}

/**
 * Floats filtering and active chips over the map. The default presentation also
 * includes the inventory summary and horizontal view navigation.
 */
export function MapTabToolbar({
  totalListings,
  searchQuery,
  onSearchChange,
  suggestions,
  filters,
  onAddFilter,
  onRemoveFilter,
  cityOptions,
  sort,
  onSortChange,
  savedViews,
  onApplyView,
  onSaveView,
  onDeleteView,
  showSavedViews = true,
  viewMode,
  onViewModeChange,
  className,
  variant = 'default',
}: MapTabToolbarProps) {
  const overlay = variant === 'overlay'

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        overlay
          ? 'items-end gap-2'
          : 'gap-3 rounded-xl border border-border bg-card p-3',
        className,
      )}
      data-testid="map-tab-toolbar"
    >
      {/* Overlay controls size to their content rather than spanning the map. */}
      <div
        className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center"
        data-testid="map-toolbar-primary-row"
      >
        {!overlay && <dl
          className="flex shrink-0 items-center"
          data-testid="summary-cards"
          aria-label="Listing summary"
        >
          <div
            className={cn(
              'hidden h-9 items-center gap-2 border-r pr-3 sm:flex',
              overlay
                ? 'border-slate-300/80 text-slate-950 dark:border-white/15 dark:text-white'
                : 'border-border text-foreground',
            )}
            data-testid="summary-card-total"
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                overlay
                  ? 'bg-blue-500/10 text-blue-600 ring-1 ring-inset ring-blue-500/20 dark:text-blue-300 dark:ring-blue-400/15'
                  : 'bg-muted text-muted-foreground',
              )}
              aria-hidden="true"
            >
              <Building2 className="h-4 w-4" />
            </span>
            <dt className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="sr-only">Total listings</span>
              <span aria-hidden="true" className="hidden sm:inline lg:hidden 2xl:inline">Total Listings</span>
              <span aria-hidden="true" className="hidden lg:inline 2xl:hidden">Listings</span>
            </dt>
            <dd
              className="text-sm font-semibold tabular-nums"
              data-testid="summary-value-total"
            >
              {totalListings}
            </dd>
          </div>
        </dl>}

        <CommandBar
          className={overlay ? 'min-w-0' : 'min-w-0 flex-1'}
          variant={variant}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          suggestions={suggestions}
          filters={filters}
          onAddFilter={onAddFilter}
          onRemoveFilter={onRemoveFilter}
          sort={sort}
          onSortChange={onSortChange}
          savedViews={savedViews}
          onApplyView={onApplyView}
          onSaveView={onSaveView}
          onDeleteView={onDeleteView}
          showSavedViews={showSavedViews}
          cityOptions={cityOptions}
          trailing={
            !overlay && <ViewSwitcher
              viewMode={viewMode}
              onChange={onViewModeChange}
              variant={variant}
            />
          }
        />
      </div>

      {/* Active filter chips below the control row (R4.4). Renders nothing when
          there are no active filters. */}
      <FilterChipBar filters={filters} onRemoveFilter={onRemoveFilter} />
    </div>
  )
}

export default MapTabToolbar
