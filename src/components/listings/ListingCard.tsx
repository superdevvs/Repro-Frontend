import * as React from 'react'
import { Bath, BedDouble, ExternalLink, Ruler, Share2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  formatLocationLine,
  getBadges,
  getMetricChips,
  priceDisplay,
  resolveCardImage,
} from '@/lib/listing-presentation/card'
import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

export interface ListingCardProps {
  /** The listing this card represents. */
  listing: ShowcaseListing
  /** Resolves a stored hero-image value into a usable URL (or null). */
  resolveImageUrl: (v: string | null | undefined) => string | null
  /** Formats a numeric price into a display string. */
  formatPrice: (p: number | undefined | null) => string
  /** Invoked when the user activates the "View Details" action. */
  onOpenListing: (listing: ShowcaseListing) => void
  /** Invoked when the user activates the "Share Invite" action. */
  onShareInvite?: (listing: ShowcaseListing) => void
  /** Whether this card represents the currently selected listing. */
  selected?: boolean
  /** Invoked with the listing id when the card (outside its actions) is selected. */
  onSelect?: (id: string) => void
  /** Additional class names for the outer card element. */
  className?: string
}

/** Maps a metric-chip kind to its lucide icon. */
const METRIC_ICONS: Record<'beds' | 'baths' | 'sqft', React.ComponentType<{ className?: string }>> = {
  beds: BedDouble,
  baths: Bath,
  sqft: Ruler,
}

/** Maps a badge label to its visual style. "Private" is the primary brand badge. */
function badgeClassName(badge: 'Private' | 'For Sale' | 'Mapped'): string {
  switch (badge) {
    case 'For Sale':
      return 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'Mapped':
      return 'border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300'
    case 'Private':
    default:
      return 'border-transparent bg-primary/10 text-primary'
  }
}

/**
 * ListingCard renders a single redesigned sidebar listing card (Listing_Card).
 *
 * It derives all display content from the pure presentation helpers
 * (`resolveCardImage`, `formatLocationLine`, `priceDisplay`, `getMetricChips`,
 * `getBadges`) and exposes "View Details" and "Share Invite" actions.
 *
 * The card itself is a non-button container so the nested action buttons remain
 * valid; when `onSelect` is provided the container becomes focusable/clickable
 * and selecting it (hover, focus, or click outside the actions) reports the
 * listing id. The action buttons stop propagation so they never trigger select.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 9.3, 9.4, 10.7
 */
export function ListingCard({
  listing,
  resolveImageUrl,
  formatPrice,
  onOpenListing,
  onShareInvite,
  selected = false,
  onSelect,
  className,
}: ListingCardProps) {
  const imageSrc = resolveCardImage(listing.heroImage, resolveImageUrl)
  const locationLine = formatLocationLine(listing)
  const price = priceDisplay(listing.price, formatPrice)
  const metrics = getMetricChips(listing)
  const badges = getBadges(listing)

  const selectable = typeof onSelect === 'function'

  const handleSelect = React.useCallback(() => {
    if (selectable) onSelect?.(listing.id)
  }, [selectable, onSelect, listing.id])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectable) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSelect()
    }
  }

  const handleViewDetails = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onOpenListing(listing)
  }

  const handleShareInvite = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onShareInvite?.(listing)
  }

  return (
    <Card
      data-listing-id={listing.id}
      data-selected={selected ? 'true' : 'false'}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      onMouseEnter={selectable ? handleSelect : undefined}
      onFocus={selectable ? handleSelect : undefined}
      onClick={selectable ? handleSelect : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
      className={cn(
        // Shared radius (R9.3, 12-16px) + single border style (R9.4).
        'group overflow-hidden rounded-2xl border border-border bg-card text-left',
        // Hover state: upward lift, blue outline, soft shadow (R3.9).
        'transition duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
        // Selected state: blue border (R10.7).
        selected && 'border-blue-500 ring-2 ring-blue-500/20',
        listing.isListingHidden && 'opacity-70',
        className,
      )}
    >
      {/* Hero image (R3.1). */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        <img
          src={imageSrc}
          alt={listing.address || 'Private listing'}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
        {/* Badges overlay (R3.6). */}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <Badge
              key={badge}
              className={cn('rounded-full px-2.5 py-0.5 text-[11px] shadow-sm backdrop-blur', badgeClassName(badge))}
            >
              {badge}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {/* Title hierarchy: Private Listing label, street address, city/state/zip (R3.2). */}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Private Listing
          </p>
          <p className="mt-0.5 truncate text-base font-semibold leading-tight text-foreground">
            {listing.address}
          </p>
          {locationLine && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{locationLine}</p>
          )}
        </div>

        {/* Price or fallback label (R3.3, R3.4). */}
        <p className="text-lg font-semibold tracking-tight text-foreground">{price}</p>

        {/* Metric chips: beds / baths / sqft each with its icon (R3.5). */}
        {metrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {metrics.map((metric) => {
              const Icon = METRIC_ICONS[metric.kind]
              return (
                <span key={metric.kind} className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  {metric.text}
                </span>
              )
            })}
          </div>
        )}

        {/* Actions: View Details + Share Invite (R3.7, R3.8). */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="h-9 flex-1 rounded-xl"
            onClick={handleViewDetails}
          >
            <ExternalLink className="h-4 w-4" />
            View Details
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 flex-1 rounded-xl border-border"
            onClick={handleShareInvite}
          >
            <Share2 className="h-4 w-4" />
            Share Invite
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ListingCard
