// Shared fast-check arbitraries for the Exclusive Listings Map Tab property tests.
//
// This module is imported by every property-based test file under
// `lib/listing-presentation/*`. It centralizes the generators so that all
// properties exercise the same rich input space:
//
//   - strings: a mix of normal, empty, whitespace-only, and non-ASCII text
//   - price: undefined / 0 / negative / NaN / normal positive / very large
//   - coordinates: valid finite (mapped), undefined (unmapped), and non-finite
//   - listing_type: every variant plus undefined
//   - bedrooms / bathrooms / sqft: undefined / 0 / negative / positive
//
// `arbitrarySavedView` produces ONLY canonical filters (the exact shape that
// `parseSavedViews` reconstructs) so the saved-view round-trip property
// (Property 12) holds under deep-equality.

import fc from 'fast-check'

import type { ShowcaseListing } from '../../components/listings/ExclusiveListingsShowcase'
import type { Filter, SavedView, SortOption } from './types'

// ---------------------------------------------------------------------------
// Primitive building blocks
// ---------------------------------------------------------------------------

/**
 * Text covering the edge cases the presentation logic must tolerate:
 * normal strings, empty, whitespace-only, and non-ASCII (graphemes + a curated
 * set of accented / CJK / Cyrillic samples).
 */
const arbitraryText: fc.Arbitrary<string> = fc.oneof(
  fc.string(),
  fc.constant(''),
  fc.constant('  '),
  fc.constant('   '),
  // Non-ASCII via grapheme clusters (emoji, combining marks, etc.).
  fc.string({ unit: 'grapheme' }),
  // A curated sample of real-world non-ASCII place / client names.
  fc.constantFrom(
    'São Paulo',
    'Zürich',
    '東京',
    'Köln',
    'Москва',
    'México',
    'Đà Nẵng',
    'naïve café',
  ),
)

/**
 * Price covering: undefined, exactly 0, negative, NaN, normal positive, and
 * very large values (both integer and floating point).
 */
const arbitraryPrice: fc.Arbitrary<number | undefined> = fc.oneof(
  fc.constant<number | undefined>(undefined),
  fc.constant(0),
  fc.integer({ min: -1_000_000, max: -1 }),
  fc.constant(NaN),
  fc.integer({ min: 1, max: 5_000_000 }),
  fc.constant(1_000_000_000_000),
  fc.double({ min: 1e9, max: 1e15, noNaN: true, noDefaultInfinity: true }),
)

/**
 * Integer-ish metric (bedrooms / bathrooms / sqft) covering undefined, 0,
 * negative, and positive.
 */
const arbitraryMetric: fc.Arbitrary<number | undefined> = fc.oneof(
  fc.constant<number | undefined>(undefined),
  fc.constant(0),
  fc.integer({ min: -10, max: -1 }),
  fc.integer({ min: 1, max: 20 }),
)

/** A single coordinate value: valid finite, undefined, or non-finite. */
const arbitraryNonFinite: fc.Arbitrary<number> = fc.constantFrom(
  NaN,
  Infinity,
  -Infinity,
)

const arbitraryLatitude: fc.Arbitrary<number> = fc.double({
  min: -90,
  max: 90,
  noNaN: true,
  noDefaultInfinity: true,
})

const arbitraryLongitude: fc.Arbitrary<number> = fc.double({
  min: -180,
  max: 180,
  noNaN: true,
  noDefaultInfinity: true,
})

/**
 * Coordinates that guarantee a healthy mix of mapped (both finite), unmapped
 * (both absent), and degenerate (non-finite / partial) listings, so that
 * `hasCoords` is exercised on both sides.
 */
const arbitraryCoords: fc.Arbitrary<{
  latitude?: number
  longitude?: number
}> = fc.oneof(
  // Mapped: both coordinates finite.
  fc.record({ latitude: arbitraryLatitude, longitude: arbitraryLongitude }),
  // Unmapped: both coordinates absent.
  fc.constant<{ latitude?: number; longitude?: number }>({
    latitude: undefined,
    longitude: undefined,
  }),
  // Degenerate: each coordinate independently finite / absent / non-finite.
  fc.record({
    latitude: fc.oneof(
      arbitraryLatitude,
      fc.constant<number | undefined>(undefined),
      arbitraryNonFinite,
    ),
    longitude: fc.oneof(
      arbitraryLongitude,
      fc.constant<number | undefined>(undefined),
      arbitraryNonFinite,
    ),
  }),
)

/**
 * Listing id. Mixes uuids (effectively unique) with a small fixed pool so that
 * properties that care about uniqueness AND properties that care about
 * collisions both get coverage.
 */
const arbitraryId: fc.Arbitrary<string> = fc.oneof(
  fc.uuid(),
  fc.string({ minLength: 1 }),
  fc.constantFrom('a', 'b', 'c', 'dup-id', 'shared'),
)

const arbitraryListingType: fc.Arbitrary<
  'for_sale' | 'for_rent' | undefined
> = fc.constantFrom<'for_sale' | 'for_rent' | undefined>(
  'for_sale',
  'for_rent',
  undefined,
)

const arbitraryCoordsSource: fc.Arbitrary<
  'api' | 'cache' | 'geocode' | undefined
> = fc.constantFrom<'api' | 'cache' | 'geocode' | undefined>(
  'api',
  'cache',
  'geocode',
  undefined,
)

const arbitraryHeroImage: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant<string | undefined>(undefined),
  fc.constant(''),
  fc.constant('  '),
  fc.webUrl(),
  fc.string(),
)

// ---------------------------------------------------------------------------
// ShowcaseListing
// ---------------------------------------------------------------------------

/**
 * A `ShowcaseListing` spanning every edge case the presentation logic must
 * tolerate. See module header for the full coverage matrix.
 */
export const arbitraryListing: fc.Arbitrary<ShowcaseListing> = fc
  .record({
    id: arbitraryId,
    address: arbitraryText,
    city: arbitraryText,
    state: arbitraryText,
    zip: arbitraryText,
    fullAddress: arbitraryText,
    heroImage: arbitraryHeroImage,
    client: fc.record({
      name: arbitraryText,
      email: fc.option(fc.emailAddress(), { nil: undefined }),
    }),
    isListingHidden: fc.boolean(),
    isPrivateListing: fc.boolean(),
    listing_type: arbitraryListingType,
    bedrooms: arbitraryMetric,
    bathrooms: arbitraryMetric,
    sqft: arbitraryMetric,
    price: arbitraryPrice,
    coordsSource: arbitraryCoordsSource,
  })
  .chain((base) =>
    arbitraryCoords.map((coords) => ({
      ...base,
      latitude: coords.latitude,
      longitude: coords.longitude,
    })),
  )

// ---------------------------------------------------------------------------
// Filters / sort / saved views
// ---------------------------------------------------------------------------

/**
 * A canonical `Filter` for each `FilterKind`:
 *   - valueless kinds (forSale / private / mapped) carry ONLY `{ kind }`
 *   - `minBeds` carries a finite number
 *   - `city` carries a string
 *
 * The canonical shape matches exactly what `validateFilter` in `saved-views.ts`
 * reconstructs, which is required for the saved-view round-trip (Property 12).
 */
export const arbitraryFilter: fc.Arbitrary<Filter> = fc.oneof(
  fc.constant<Filter>({ kind: 'forSale' }),
  fc.constant<Filter>({ kind: 'private' }),
  fc.constant<Filter>({ kind: 'mapped' }),
  // minBeds: a finite number (integers round-trip exactly through JSON).
  fc
    .integer({ min: -5, max: 20 })
    .map<Filter>((value) => ({ kind: 'minBeds', value })),
  // city: an arbitrary string (incl. empty / whitespace / non-ASCII).
  arbitraryText.map<Filter>((value) => ({ kind: 'city', value })),
)

/** Every supported sort option. */
export const arbitrarySortOption: fc.Arbitrary<SortOption> =
  fc.constantFrom<SortOption>(
    'priceDesc',
    'priceAsc',
    'cityAsc',
    'newest',
    'mappedFirst',
  )

/**
 * A `SavedView` built from canonical filters and a known sort option, so that
 * `serializeSavedViews` -> `parseSavedViews` round-trips under deep-equality
 * (Property 12).
 */
export const arbitrarySavedView: fc.Arbitrary<SavedView> = fc.record({
  id: fc.string(),
  name: fc.string(),
  filters: fc.array(arbitraryFilter),
  sort: arbitrarySortOption,
})
