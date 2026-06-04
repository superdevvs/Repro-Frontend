// Coordinating hook for the Exclusive Listings Map Tab.
//
// `useListingPresentation` is a thin, reactive wrapper around the pure logic in
// `lib/listing-presentation/*`. It owns the small amount of presentation state
// (active filters, sort option, saved views, selected listing) and derives the
// displayed listing set, summary statistics, suggestions, and filter chips with
// `useMemo`/`useCallback` so they recompute automatically when `listings`,
// `filters`, `sort`, or `searchQuery` change.
//
// All computation is client-side and synchronous: no network calls are issued
// for filtering, sorting, summary, or suggestions (R4.3, R5.2).
//
// Saved-views persistence contract (consumed by PrivateListingPortal, task 19.1):
//   - The hook DOES NOT touch localStorage itself. It manages `savedViews` in
//     React state only.
//   - `initialSavedViews` seeds that state on the INITIAL mount only (read once
//     via the `useState` initializer). The portal is expected to read persisted
//     views from localStorage synchronously on mount and pass them in here.
//   - `onSavedViewsChange` (optional) is invoked with the next array whenever
//     the saved-views collection changes — i.e. from `saveView` and
//     `deleteView` (the only mutators). It is NOT invoked on mount and NOT
//     invoked by `applyView` (which changes filters/sort, not the collection).
//     The portal wires this callback to persist the views to localStorage.
//
// Validates: Requirements 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 5.3, 10.4, 10.5, 10.9.

import { useCallback, useMemo, useState } from 'react'

import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'
import {
  addFilter as addFilterPure,
  applyFilters,
  getFilterChips,
  removeFilter as removeFilterPure,
} from '@/lib/listing-presentation/filters'
import { sortListings } from '@/lib/listing-presentation/sorting'
import { buildSuggestions } from '@/lib/listing-presentation/suggestions'
import { computeSummary } from '@/lib/listing-presentation/summary'
import {
  normalizeSelection,
  selectListing as selectListingPure,
} from '@/lib/listing-presentation/selection'
import type {
  Filter,
  FilterChip,
  FilterKey,
  SavedView,
  SortOption,
  Suggestion,
  Summary,
} from '@/lib/listing-presentation/types'

/** Input to {@link useListingPresentation}. */
export interface UseListingPresentationInput {
  /** The already-loaded listing set (e.g. from PrivateListingPortal). */
  listings: ShowcaseListing[]
  /** Free-text search query from the Command Bar. */
  searchQuery: string
  /**
   * Saved views to seed the hook's state with on the INITIAL mount only.
   * Subsequent changes to this prop are ignored; persistence is owned by the
   * caller (see the persistence contract in the module header).
   */
  initialSavedViews?: SavedView[]
  /**
   * Called with the next saved-views array whenever the collection changes
   * (via `saveView`/`deleteView`). Wire this to localStorage persistence.
   */
  onSavedViewsChange?: (views: SavedView[]) => void
}

/** Everything the Map Tab surfaces need from the coordinating hook. */
export interface UseListingPresentationResult {
  /** Search-text → filter → sort pipeline output (what the UI renders). */
  displayedListings: ShowcaseListing[]
  /** Summary statistics over `displayedListings` (recomputed on filter change). */
  summary: Summary
  /** Categorized search suggestions derived from the full listing set. */
  suggestions: Suggestion[]
  /** Active filters (AND semantics). */
  filters: Filter[]
  /** Add a filter (de-duplicated by stable key). */
  addFilter: (filter: Filter) => void
  /** Remove the filter with the given stable key. */
  removeFilter: (key: FilterKey) => void
  /** One removable chip per active filter. */
  filterChips: FilterChip[]
  /** Active sort option (defaults to `'newest'`). */
  sort: SortOption
  /** Set the active sort option. */
  setSort: (sort: SortOption) => void
  /** Persisted saved views (managed in state; persistence owned by caller). */
  savedViews: SavedView[]
  /** Apply a saved view's filters + sort by id (no-op if not found). */
  applyView: (id: string) => void
  /** Capture the current filters + sort as a new saved view with the given name. */
  saveView: (name: string) => void
  /** Delete the saved view with the given id. */
  deleteView: (id: string) => void
  /** The single shared selected-listing id (normalized against displayed listings). */
  selectedListingId: string | null
  /** Select a listing by id (from a marker click or a card click). */
  selectListing: (id: string) => void
}

/**
 * Case-insensitive search-text predicate matching the loaded listings against
 * `address`, `city`, `state`, `zip`, and `client.name`. An empty/whitespace
 * query matches all listings (returns the input unchanged).
 */
function applySearch(
  listings: ShowcaseListing[],
  searchQuery: string,
): ShowcaseListing[] {
  const trimmed = searchQuery.trim()
  if (trimmed === '') return listings

  const query = trimmed.toLowerCase()
  return listings.filter((listing) => {
    const fields = [
      listing.address,
      listing.city,
      listing.state,
      listing.zip,
      listing.client?.name,
    ]
    return fields.some(
      (field) => typeof field === 'string' && field.toLowerCase().includes(query),
    )
  })
}

/**
 * Reactive coordinator over the pure listing-presentation logic.
 *
 * Owns `filters`, `sort`, `savedViews`, and the selected-listing id; derives
 * `displayedListings`, `summary`, `suggestions`, and `filterChips` via memos so
 * they recompute when `listings`, `filters`, `sort`, or `searchQuery` change.
 */
export function useListingPresentation({
  listings,
  searchQuery,
  initialSavedViews,
  onSavedViewsChange,
}: UseListingPresentationInput): UseListingPresentationResult {
  const [filters, setFilters] = useState<Filter[]>([])
  const [sort, setSortState] = useState<SortOption>('newest')
  const [savedViews, setSavedViews] = useState<SavedView[]>(
    initialSavedViews ?? [],
  )
  // Raw selection; the exposed `selectedListingId` is normalized against the
  // displayed set so it always stays valid as the listing set changes (R10.9).
  const [rawSelectedListingId, setRawSelectedListingId] = useState<string | null>(
    null,
  )

  // Search text is applied first (existing behavior), then filters, then sort.
  const textFilteredListings = useMemo(
    () => applySearch(listings, searchQuery),
    [listings, searchQuery],
  )

  const displayedListings = useMemo(
    () => sortListings(applyFilters(textFilteredListings, filters), sort),
    [textFilteredListings, filters, sort],
  )

  // Summary reflects the same filtered set the sidebar shows; recomputes on
  // any filter/sort/search/listings change (R5.3).
  const summary = useMemo(
    () => computeSummary(displayedListings),
    [displayedListings],
  )

  // Suggestions are derived from the FULL listing set (not the filtered one) so
  // the user can search across everything they have loaded.
  const suggestions = useMemo(
    () => buildSuggestions(listings, searchQuery),
    [listings, searchQuery],
  )

  const filterChips = useMemo(() => getFilterChips(filters), [filters])

  // Always expose a normalized selection: null or an id present in the
  // currently displayed listings (R10.9). Keeps map + sidebar in agreement.
  const selectedListingId = useMemo(
    () => normalizeSelection(displayedListings, rawSelectedListingId),
    [displayedListings, rawSelectedListingId],
  )

  const addFilter = useCallback((filter: Filter) => {
    setFilters((prev) => addFilterPure(prev, filter))
  }, [])

  const removeFilter = useCallback((key: FilterKey) => {
    setFilters((prev) => removeFilterPure(prev, key))
  }, [])

  const setSort = useCallback((next: SortOption) => {
    setSortState(next)
  }, [])

  const selectListing = useCallback(
    (id: string) => {
      setRawSelectedListingId(selectListingPure(displayedListings, id))
    },
    [displayedListings],
  )

  const applyView = useCallback(
    (id: string) => {
      const view = savedViews.find((v) => v.id === id)
      if (!view) return
      setFilters(view.filters)
      setSortState(view.sort)
    },
    [savedViews],
  )

  const saveView = useCallback(
    (name: string) => {
      const view: SavedView = {
        id: `v_${Date.now()}`,
        name,
        filters,
        sort,
      }
      const next = [...savedViews, view]
      setSavedViews(next)
      onSavedViewsChange?.(next)
    },
    [filters, sort, savedViews, onSavedViewsChange],
  )

  const deleteView = useCallback(
    (id: string) => {
      const next = savedViews.filter((v) => v.id !== id)
      setSavedViews(next)
      onSavedViewsChange?.(next)
    },
    [savedViews, onSavedViewsChange],
  )

  return {
    displayedListings,
    summary,
    suggestions,
    filters,
    addFilter,
    removeFilter,
    filterChips,
    sort,
    setSort,
    savedViews,
    applyView,
    saveView,
    deleteView,
    selectedListingId,
    selectListing,
  }
}
