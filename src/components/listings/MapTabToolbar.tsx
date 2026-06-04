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
  viewMode,
  onViewModeChange,
  className,
  variant = 'default',
}: MapTabToolbarProps) {
  const overlay = variant === 'overlay'

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border',
        overlay
          ? 'gap-2 border-slate-300/80 bg-white/82 p-2.5 text-slate-950 shadow-xl backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/72 dark:text-white'
          : 'gap-3 border-border bg-card p-3',
        className,
      )}
    >
      {/* Top row: CommandBar grows on the left, ViewSwitcher sits on the right,
          wrapping responsively while staying in one horizontal control group
          (R4.1, R6.1). */}
      <div className="flex flex-wrap items-center gap-3">
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
