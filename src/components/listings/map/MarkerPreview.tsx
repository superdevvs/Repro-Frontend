// Marker preview popup for the Exclusive Listings Map Tab.
//
// `MarkerPreview` is a thin, presentational card that summarizes a single
// listing for use over the map: on hover over a custom pin (R10.3) and as the
// popup shown for the currently selected listing (R10.8). It is compact by
// design so it fits inside a MapLibre popup / hover card.
//
// It delegates all derivation to the pure card-presentation helpers
// (`resolveCardImage`, `formatLocationLine`, `priceDisplay`) and never issues a
// network call or mutates its props.
//
// Validates: Requirements 10.3, 10.8

import * as React from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  DEFAULT_PLACEHOLDER_IMAGE,
  formatLocationLine,
  priceDisplay,
  resolveCardImage,
} from '@/lib/listing-presentation/card'
import { type ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

export interface MarkerPreviewProps {
  /** The listing summarized by this preview. */
  listing: ShowcaseListing
  /** Resolves a stored image reference to a usable URL (or null). */
  resolveImageUrl: (value: string | null | undefined) => string | null
  /** Formats a numeric price into a display string. */
  formatPrice: (price: number | undefined | null) => string
  /** Optional call-to-action invoked when "View Details" is activated. */
  onOpenListing?: (listing: ShowcaseListing) => void
  relatedListings?: ShowcaseListing[]
  onSelectListing?: (id: string) => void
  /** Optional extra classes for the outer card. */
  className?: string
}

/**
 * Compact preview card for a single listing, shown over the map on marker
 * hover (R10.3) and for the selected listing (R10.8). Always renders an image,
 * the street address, and a call-to-action.
 */
export function MarkerPreview({
  listing,
  resolveImageUrl,
  formatPrice,
  onOpenListing,
  relatedListings = [],
  onSelectListing,
  className,
}: MarkerPreviewProps) {
  const imageUrl = resolveCardImage(listing.heroImage, resolveImageUrl, DEFAULT_PLACEHOLDER_IMAGE)
  const price = priceDisplay(listing.price, formatPrice)
  const locationLine = formatLocationLine(listing)
  const address = listing.address?.trim() || listing.fullAddress?.trim() || 'Private Listing'
  const locationListings = relatedListings.length > 0 ? relatedListings : [listing]
  const currentIndex = Math.max(
    0,
    locationListings.findIndex((candidate) => candidate.id === listing.id),
  )
  const hasMultipleShoots = locationListings.length > 1
  const selectOffset = (offset: number) => {
    if (!hasMultipleShoots) return
    const nextIndex =
      (currentIndex + offset + locationListings.length) % locationListings.length
    onSelectListing?.(locationListings[nextIndex].id)
  }

  return (
    <Card
      className={cn(
        'w-64 overflow-hidden rounded-2xl border-border bg-card text-card-foreground shadow-lg dark:border-border',
        className,
      )}
    >
      <div className="relative h-28 w-full overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt={address}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(event) => {
            const target = event.currentTarget
            if (target.src.endsWith(DEFAULT_PLACEHOLDER_IMAGE)) return
            target.src = DEFAULT_PLACEHOLDER_IMAGE
          }}
        />
        <Badge
          variant="secondary"
          className="absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-semibold text-white"
        >
          Private
        </Badge>
        {hasMultipleShoots ? (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg border border-white/20 bg-slate-950/75 px-1 py-1 text-white backdrop-blur-md">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Previous shoot at this location"
              className="h-7 w-7 text-white hover:bg-white/15 hover:text-white"
              onClick={() => selectOffset(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[11px] font-semibold">
              {currentIndex + 1} of {locationListings.length} shoots
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Next shoot at this location"
              className="h-7 w-7 text-white hover:bg-white/15 hover:text-white"
              onClick={() => selectOffset(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">{price}</p>

        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{address}</p>

        {locationLine.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{locationLine}</span>
          </div>
        )}

        <Button
          type="button"
          size="sm"
          className="mt-1 w-full rounded-xl"
          onClick={() => onOpenListing?.(listing)}
        >
          <ExternalLink className="h-4 w-4" />
          View Details
        </Button>
      </div>
    </Card>
  )
}

export default MarkerPreview
