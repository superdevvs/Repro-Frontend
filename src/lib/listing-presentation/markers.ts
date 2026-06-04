// Marker derivation for the Exclusive Listings Map Tab.
//
// These pure helpers turn the already-loaded listing set into the marker model
// consumed by the Map_Region, and provide the geometry helpers used by the
// recenter action. They are pure and synchronous: no side effects, no network
// calls, and no mutation of their inputs.
//
// Validates:
// - Requirements 10.1 (Property 16: markers correspond one-to-one with mapped
//   listings)
// - Requirements 10.2 (Property 17: marker label reflects price presence)
// - Requirements 8.2  (Property 15: recenter center lies within the listings'
//   bounds)

import type { MarkerModel } from './types'
import {
  type ShowcaseListing,
  hasCoords,
} from '../../components/listings/ExclusiveListingsShowcase'

/**
 * Default map center used when there are no mapped listings to center on
 * (geographic center of the contiguous United States). Mirrors the existing
 * `DEFAULT_LISTING_CENTER` in `ExclusiveListingsShowcase` so the map falls back
 * to a sensible, stable location rather than `(0, 0)`.
 */
export const DEFAULT_MAP_CENTER: { lat: number; lng: number } = {
  lat: 39.8283,
  lng: -98.5795,
}

/** Short, non-empty fallback shown when a listing has no usable price. */
const PRICE_FALLBACK_LABEL = 'Private Listing'

/** True when `price` is a finite, strictly positive number. */
function hasPositivePrice(price: number | undefined | null): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price > 0
}

/**
 * Format a positive price into a compact, human-readable string:
 * - `>= 1,000,000` → `$1.5M` (one decimal, trimmed when whole, e.g. `$2M`)
 * - `>= 1,000`     → `$850K` (rounded to the nearest thousand)
 * - otherwise      → `$500`  (rounded to the nearest dollar)
 */
function formatCompactPrice(price: number): string {
  if (price >= 1_000_000) {
    const compact = price / 1_000_000
    return `$${compact % 1 === 0 ? compact.toFixed(0) : compact.toFixed(1)}M`
  }
  if (price >= 1_000) {
    return `$${Math.round(price / 1_000)}K`
  }
  return `$${Math.round(price)}`
}

/**
 * The label shown on a listing's marker (R10.2).
 *
 * Returns a compact price string when the listing has a positive finite price,
 * otherwise a short, non-empty fallback label (`"Private Listing"`). The result
 * is never empty (Property 17).
 */
export function markerLabel(l: ShowcaseListing): string {
  return hasPositivePrice(l.price)
    ? formatCompactPrice(l.price)
    : PRICE_FALLBACK_LABEL
}

/**
 * Build the marker models for a set of listings (R10.1).
 *
 * Returns exactly one marker per mapped listing (a listing with finite
 * coordinates, per {@link hasCoords}) and none for unmapped listings. Each
 * marker preserves its source listing's id (`marker.id === listing.id`), takes
 * its coordinates from the listing's `latitude`/`longitude`, and takes its
 * label from {@link markerLabel}. The resulting set bijects with the mapped
 * subset of the input (Property 16).
 */
export function buildMarkers(listings: ShowcaseListing[]): MarkerModel[] {
  const markers: MarkerModel[] = []
  for (const listing of listings) {
    if (!hasCoords(listing)) continue
    markers.push({
      id: listing.id,
      label: markerLabel(listing),
      // hasCoords guarantees both are finite numbers.
      coords: {
        lat: listing.latitude as number,
        lng: listing.longitude as number,
      },
    })
  }
  return markers
}

/**
 * Compute the axis-aligned bounding box of a set of coordinates.
 *
 * Returns `null` for empty input; otherwise returns the min/max latitude and
 * longitude observed across the coordinates.
 */
export function computeBounds(
  coords: { lat: number; lng: number }[],
): { min: { lat: number; lng: number }; max: { lat: number; lng: number } } | null {
  if (coords.length === 0) return null

  let minLat = coords[0].lat
  let maxLat = coords[0].lat
  let minLng = coords[0].lng
  let maxLng = coords[0].lng

  for (let i = 1; i < coords.length; i += 1) {
    const { lat, lng } = coords[i]
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }

  return {
    min: { lat: minLat, lng: minLng },
    max: { lat: maxLat, lng: maxLng },
  }
}

/** Clamp `value` into the inclusive range `[lo, hi]`. */
function clamp(value: number, lo: number, hi: number): number {
  if (value < lo) return lo
  if (value > hi) return hi
  return value
}

/**
 * Resolve the map center for the recenter action (R8.2).
 *
 * Behavior (Property 15):
 * - For an empty marker set, returns {@link DEFAULT_MAP_CENTER}.
 * - For a single marker, returns that marker's exact coordinate.
 * - When `selectedId` matches a marker, centers on that marker's coordinate
 *   (which is itself within the bounds of all markers).
 * - Otherwise, returns the centroid (mean) of all marker coordinates.
 *
 * In every non-empty case the returned coordinate is clamped to the min/max
 * bounds of the markers' coordinates, so its latitude and longitude always lie
 * within those bounds.
 */
export function getMapCenter(
  markers: MarkerModel[],
  selectedId: string | null,
): { lat: number; lng: number } {
  if (markers.length === 0) return { ...DEFAULT_MAP_CENTER }

  const coords = markers.map((m) => m.coords)
  // Non-null because markers is non-empty.
  const bounds = computeBounds(coords) as {
    min: { lat: number; lng: number }
    max: { lat: number; lng: number }
  }

  // Prefer centering on the selected marker when it exists in the set.
  const selected =
    selectedId !== null ? markers.find((m) => m.id === selectedId) : undefined

  let candidate: { lat: number; lng: number }
  if (selected) {
    candidate = selected.coords
  } else if (markers.length === 1) {
    candidate = markers[0].coords
  } else {
    const totals = coords.reduce(
      (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
      { lat: 0, lng: 0 },
    )
    candidate = {
      lat: totals.lat / coords.length,
      lng: totals.lng / coords.length,
    }
  }

  // Clamp to bounds so floating-point rounding of the centroid can never push
  // the center outside the observed min/max range (Property 15).
  return {
    lat: clamp(candidate.lat, bounds.min.lat, bounds.max.lat),
    lng: clamp(candidate.lng, bounds.min.lng, bounds.max.lng),
  }
}
