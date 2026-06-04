// Saved Views persistence logic for the Exclusive Listings Map Tab.
//
// Saved Views are a named, persisted combination of active filters and sort
// order. They are stored in localStorage under `SAVED_VIEWS_KEY` as a JSON
// array of `SavedView`.
//
// This module provides only the pure (de)serialization logic; the actual
// localStorage read/write happens in an effect in `PrivateListingPortal`
// (mirroring the geo-cache write pattern). Both functions are pure and have no
// side effects.
//
// Validates: Requirements 4.7, 4.8 (Property 12: round-trip) and 4.9
// (Property 13: parsing is total and safe).

import type { Filter, FilterKind, SavedView, SortOption } from './types'

/** localStorage key for persisted Saved Views (separate from the geo-cache). */
export const SAVED_VIEWS_KEY = 'exclusive-listing-saved-views-v1'

// Known value sets used for tolerant validation. Kept in sync with `types.ts`.
const KNOWN_FILTER_KINDS: ReadonlySet<FilterKind> = new Set<FilterKind>([
  'forSale',
  'private',
  'mapped',
  'minBeds',
  'city',
])

const KNOWN_SORT_OPTIONS: ReadonlySet<SortOption> = new Set<SortOption>([
  'priceDesc',
  'priceAsc',
  'cityAsc',
  'newest',
  'mappedFirst',
])

/**
 * Serialize a list of Saved Views to a JSON string for localStorage.
 *
 * This is the exact inverse of `parseSavedViews` for valid views, giving a
 * round-trip (Property 12).
 */
export function serializeSavedViews(views: SavedView[]): string {
  return JSON.stringify(views)
}

/**
 * Parse Saved Views from a raw localStorage string.
 *
 * Tolerant and total (Property 13): never throws. Returns the empty array for
 * `null`, non-JSON, or non-array JSON. Each entry is validated against the
 * `SavedView` shape; invalid entries are dropped. If every entry is invalid (or
 * the input is otherwise unrecoverable), the empty array is returned.
 *
 * Valid entries are reconstructed into a canonical `SavedView` so that parsing
 * never alters the structure of a valid view (Property 12 round-trip).
 */
export function parseSavedViews(raw: string | null): SavedView[] {
  if (raw == null) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const result: SavedView[] = []
  for (const entry of parsed) {
    const view = validateSavedView(entry)
    if (view !== null) result.push(view)
  }
  return result
}

/**
 * Validate and canonicalize a single candidate entry.
 *
 * Returns a canonical `SavedView` when the entry has all required fields with
 * appropriate types, or `null` when the entry is invalid (and should be
 * dropped). Never throws.
 */
function validateSavedView(entry: unknown): SavedView | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return null
  }

  const candidate = entry as Record<string, unknown>

  if (typeof candidate.id !== 'string') return null
  if (typeof candidate.name !== 'string') return null
  if (!Array.isArray(candidate.filters)) return null
  if (
    typeof candidate.sort !== 'string' ||
    !KNOWN_SORT_OPTIONS.has(candidate.sort as SortOption)
  ) {
    return null
  }

  const filters: Filter[] = []
  for (const rawFilter of candidate.filters) {
    const filter = validateFilter(rawFilter)
    // A SavedView's `filters` must be an array of *valid* Filters. A single
    // invalid filter makes the whole entry invalid (drop it) so we never
    // silently alter the structure of an otherwise-valid view.
    if (filter === null) return null
    filters.push(filter)
  }

  return {
    id: candidate.id,
    name: candidate.name,
    filters,
    sort: candidate.sort as SortOption,
  }
}

/**
 * Validate and canonicalize a single candidate filter.
 *
 * Returns a canonical `Filter` ({ kind } for valueless kinds, { kind, value }
 * for `minBeds`/`city`) or `null` when invalid. The value type must be
 * appropriate for the kind: `minBeds` requires a finite number, `city`
 * requires a string.
 */
function validateFilter(entry: unknown): Filter | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return null
  }

  const candidate = entry as Record<string, unknown>
  const kind = candidate.kind

  if (typeof kind !== 'string' || !KNOWN_FILTER_KINDS.has(kind as FilterKind)) {
    return null
  }

  switch (kind as FilterKind) {
    case 'minBeds': {
      const value = candidate.value
      if (typeof value !== 'number' || !Number.isFinite(value)) return null
      return { kind: 'minBeds', value }
    }
    case 'city': {
      const value = candidate.value
      if (typeof value !== 'string') return null
      return { kind: 'city', value }
    }
    case 'forSale':
    case 'private':
    case 'mapped':
      // Valueless kinds: a canonical filter carries only `kind`.
      return { kind: kind as FilterKind }
    default:
      return null
  }
}
