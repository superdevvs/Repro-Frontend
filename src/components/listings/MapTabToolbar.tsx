// MapTabToolbar — the cohesive control group rendered above the Exclusive
// Listings Map Tab.
//
// This is a thin, composed UI renderer that arranges three existing pieces into
// a single, aligned control group (R4.1, R6.1):
//   1. `CommandBar`    — search + filter trigger + sort + saved-views
//   2. `ViewSwitcher`  — Map/Grid/List segmented control
//   3. `FilterChipBar` — removable chips for the active filters
//
// Layout: a top row aligns the `CommandBar` on the left (it grows to fill the
// available width) with the `ViewSwitcher` on the right, in one horizontal
// control group that wraps responsively. Below that row, the `FilterChipBar`
// shows the active filter chips (it renders nothing when there are no filters).
//
// Visual consistency (R9.3, R9.4): the toolbar surface uses a single consistent
// corner radius (`rounded-xl`) and a single border style (`border-border`) with
// theme tokens, so it reads as one cohesive surface with the rest of the Map Tab.

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
 * Composes `CommandBar`, `ViewSwitcher`, and `FilterChipBar` into one aligned
 * control group above the Map Tab. The matching props are forwarded down to
 * each child; this component owns only layout and visual cohesion.
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
        'flex min-w-0 flex-col rounded-xl border',
        overlay
          ? 'gap-2 border-slate-300/80 bg-white/82 p-2.5 text-slate-950 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/72 dark:text-white'
          : 'gap-3 border-border bg-card p-3',
        className,
      )}
      data-testid="map-tab-toolbar"
    >
      {/* Primary row: inventory context, search, filters, sorting, and view mode
          share one command surface. The search is the only flexible item, so
          it gives up width first on narrower desktop canvases. */}
      <div
        className="flex min-w-0 flex-nowrap items-center gap-2"
        data-testid="map-toolbar-primary-row"
      >
        <dl
          className="flex shrink-0 items-center"
          data-testid="summary-cards"
          aria-label="Listing summary"
        >
          <div
            className={cn(
              'flex h-9 items-center gap-2 border-r pr-3',
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
              <span aria-hidden="true" className="lg:hidden 2xl:inline">Total Listings</span>
              <span aria-hidden="true" className="hidden lg:inline 2xl:hidden">Listings</span>
            </dt>
            <dd
              className="text-sm font-semibold tabular-nums"
              data-testid="summary-value-total"
            >
              {totalListings}
            </dd>
          </div>
        </dl>

        <CommandBar
          className="min-w-0 flex-1"
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
        />
        <div className="ml-auto shrink-0">
          <ViewSwitcher
            viewMode={viewMode}
            onChange={onViewModeChange}
            variant={variant}
          />
        </div>
      </div>

      {/* Active filter chips below the control row (R4.4). Renders nothing when
          there are no active filters. */}
      <FilterChipBar filters={filters} onRemoveFilter={onRemoveFilter} />
    </div>
  )
}

export default MapTabToolbar
