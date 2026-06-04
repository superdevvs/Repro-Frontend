// Presentation domain types for the Exclusive Listings Map Tab.
//
// These are client-side TypeScript shapes operated on by the pure functions in
// `lib/listing-presentation/*` and consumed by the `useListingPresentation` hook.
// No persisted backend models are added by this feature.

export type FilterKind = 'forSale' | 'private' | 'mapped' | 'minBeds' | 'city'

export interface Filter {
  kind: FilterKind
  // minBeds carries a numeric threshold (e.g., 3 for "3+ Beds"); city carries a city name.
  value?: number | string
}

// Stable identity for chips / removal: e.g. "forSale", "minBeds:3", "city:Austin"
export type FilterKey = string

export interface FilterChip {
  key: FilterKey
  label: string // e.g. "For Sale", "3+ Beds", "Austin"
}

export type SortOption =
  | 'priceDesc'
  | 'priceAsc'
  | 'cityAsc'
  | 'newest' // completedDate/scheduledDate desc (current default)
  | 'mappedFirst'

export interface SavedView {
  id: string
  name: string
  filters: Filter[]
  sort: SortOption
}

export interface Summary {
  total: number
  mapped: number
  unmapped: number
  private: number
  hidden: number
}

export type SuggestionCategory = 'Address' | 'City' | 'State' | 'ZIP' | 'Client'

export interface Suggestion {
  category: SuggestionCategory
  value: string
  listingId: string
}

export interface MarkerModel {
  id: string // === listing.id
  label: string // price or short fallback label
  coords: { lat: number; lng: number }
}
