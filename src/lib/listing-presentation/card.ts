// Sidebar listing-card presentation logic for the Exclusive Listings Map Tab.
//
// These are pure, synchronous helpers that derive the display shape of a
// `Listing_Card` (image source, location line, price label, metric chips, and
// badge set) from an already-loaded listing. They never issue network calls and
// never mutate their inputs.
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
//   Property 2: Card image always resolves to a non-empty source
//   Property 3: Location line omits blanks and has no stray separators
//   Property 4: Price display reflects price presence
//   Property 5: Metric chips correspond exactly to present metrics
//   Property 6: Badge set is derived correctly from listing flags

import { type ShowcaseListing, hasCoords } from '../../components/listings/ExclusiveListingsShowcase'

/** Default placeholder image used when a listing has no usable hero image. */
export const DEFAULT_PLACEHOLDER_IMAGE = '/placeholder.svg'

/** Fallback price label shown when a listing has no positive, finite price. */
export const PRICE_FALLBACK_LABEL = 'Price upon request'

/** A blank value is null/undefined or a string that is empty after trimming. */
function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0
}

/** A present, positive, finite number (e.g. for beds/baths/sqft and price). */
function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Resolve the image source for a listing card.
 *
 * Applies the caller-provided `resolve` function to `heroImage` and falls back
 * to `placeholder` when the resolved value is blank, whitespace-only, or null.
 *
 * Guarantees (Property 2 / Requirement 3.1):
 * - Always returns a non-empty string.
 * - Returns exactly the placeholder when the input resolves to a blank value.
 */
export function resolveCardImage(
  heroImage: string | null | undefined,
  resolve: (v?: string | null) => string | null,
  placeholder: string = DEFAULT_PLACEHOLDER_IMAGE,
): string {
  // Guarantee a non-empty placeholder even if a blank one is supplied.
  const safePlaceholder = isBlank(placeholder) ? DEFAULT_PLACEHOLDER_IMAGE : placeholder

  let resolved: string | null
  try {
    resolved = resolve(heroImage)
  } catch {
    resolved = null
  }

  if (isBlank(resolved)) return safePlaceholder
  return resolved as string
}

/**
 * Build the "City, State Zip" location line for a listing card.
 *
 * City and state are joined with ", " and the zip is appended after a single
 * space. Blank/whitespace-only segments are omitted.
 *
 * Guarantees (Property 3 / Requirement 3.2):
 * - Includes every non-blank segment and excludes every blank segment.
 * - Contains no leading, trailing, or doubled separators.
 */
export function formatLocationLine(l: Pick<ShowcaseListing, 'city' | 'state' | 'zip'>): string {
  const city = (l.city ?? '').trim()
  const state = (l.state ?? '').trim()
  const zip = (l.zip ?? '').trim()

  const cityState = [city, state].filter((segment) => segment.length > 0).join(', ')

  if (zip.length === 0) return cityState
  if (cityState.length === 0) return zip
  return `${cityState} ${zip}`
}

/**
 * Build the price label for a listing card.
 *
 * Guarantees (Property 4 / Requirements 3.3, 3.4):
 * - Returns the formatted price for any positive, finite price.
 * - Returns a non-empty fallback label for missing/zero/negative/NaN/non-finite
 *   prices.
 */
export function priceDisplay(
  price: number | undefined | null,
  format: (p?: number | null) => string,
): string {
  if (isPositiveNumber(price)) {
    const formatted = format(price)
    if (typeof formatted === 'string' && formatted.trim().length > 0) {
      return formatted
    }
  }
  return PRICE_FALLBACK_LABEL
}

/**
 * Derive the bed/bath/sqft metric chips for a listing card.
 *
 * Guarantees (Property 5 / Requirement 3.5): includes a chip for a metric iff
 * that metric is present and positive. Order is always beds, baths, sqft.
 */
export function getMetricChips(
  l: ShowcaseListing,
): Array<{ kind: 'beds' | 'baths' | 'sqft'; text: string }> {
  const chips: Array<{ kind: 'beds' | 'baths' | 'sqft'; text: string }> = []

  if (isPositiveNumber(l.bedrooms)) {
    chips.push({ kind: 'beds', text: `${l.bedrooms} ${l.bedrooms === 1 ? 'Bed' : 'Beds'}` })
  }
  if (isPositiveNumber(l.bathrooms)) {
    chips.push({ kind: 'baths', text: `${l.bathrooms} ${l.bathrooms === 1 ? 'Bath' : 'Baths'}` })
  }
  if (isPositiveNumber(l.sqft)) {
    chips.push({ kind: 'sqft', text: `${l.sqft.toLocaleString()} sqft` })
  }

  return chips
}

/**
 * Derive the badge set for a listing card.
 *
 * Guarantees (Property 6 / Requirement 3.6):
 * - Always includes "Private".
 * - Includes "For Sale" iff `listing_type === 'for_sale'`.
 * - Includes "Mapped" iff the listing has finite coordinates.
 */
export function getBadges(l: ShowcaseListing): Array<'Private' | 'For Sale' | 'Mapped'> {
  const badges: Array<'Private' | 'For Sale' | 'Mapped'> = ['Private']

  if (l.listing_type === 'for_sale') badges.push('For Sale')
  if (hasCoords(l)) badges.push('Mapped')

  return badges
}
