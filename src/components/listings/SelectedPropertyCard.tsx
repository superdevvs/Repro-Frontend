import { Bookmark, ExternalLink, MapPin, Share2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  formatLocationLine,
  getMetricChips,
  priceDisplay,
  resolveCardImage,
} from '@/lib/listing-presentation/card'
import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

interface SelectedPropertyCardProps {
  listing: ShowcaseListing
  resolveImageUrl: (value: string | null | undefined) => string | null
  formatPrice: (price: number | undefined | null) => string
  bookmarked: boolean
  onOpenListing: (listing: ShowcaseListing) => void
  onShareListing: (listing: ShowcaseListing) => void
  onFocusOnMap: (listing: ShowcaseListing) => void
  onToggleBookmark: (listing: ShowcaseListing) => void
}

const badgeClassName = (badge: string) => {
  if (badge === 'For Sale') {
    return 'border-emerald-400/30 bg-emerald-500 text-white'
  }
  if (badge === 'For Rent') {
    return 'border-sky-400/30 bg-sky-500 text-white'
  }
  if (badge === 'Mapped') {
    return 'border-slate-500/30 bg-slate-800/90 text-white'
  }
  if (badge === 'Unmapped') {
    return 'border-amber-400/30 bg-amber-500 text-white'
  }
  return 'border-blue-400/30 bg-blue-600 text-white'
}

export function SelectedPropertyCard({
  listing,
  resolveImageUrl,
  formatPrice,
  bookmarked,
  onOpenListing,
  onShareListing,
  onFocusOnMap,
  onToggleBookmark,
}: SelectedPropertyCardProps) {
  const imageSrc = resolveCardImage(listing.heroImage, resolveImageUrl)
  const locationLine = formatLocationLine(listing)
  const price = priceDisplay(listing.price, formatPrice)
  const metrics = getMetricChips(listing)
  const mapped = Number.isFinite(listing.latitude) && Number.isFinite(listing.longitude)
  const badges = [
    'Private',
    listing.listing_type === 'for_sale'
      ? 'For Sale'
      : listing.listing_type === 'for_rent'
        ? 'For Rent'
        : null,
    mapped ? 'Mapped' : 'Unmapped',
  ].filter(Boolean) as string[]

  return (
    <Card
      data-listing-id={listing.id}
      data-selected="true"
      className="overflow-hidden rounded-xl border-blue-500 bg-slate-950/35 text-white shadow-none ring-1 ring-blue-400/25"
    >
      <div className="relative aspect-[16/5] overflow-hidden bg-slate-900">
        <img
          src={imageSrc}
          alt={listing.address || 'Selected private listing'}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <Badge
              key={badge}
              className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold shadow-md', badgeClassName(badge))}
            >
              {badge}
            </Badge>
          ))}
        </div>
        <Button
          type="button"
          size="icon"
          variant="glass"
          title={bookmarked ? 'Remove bookmark' : 'Bookmark listing'}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark listing'}
          className="absolute right-2.5 top-2.5 h-8 w-8 rounded-lg border-white/20 bg-slate-950/75 text-white hover:bg-slate-950"
          onClick={() => onToggleBookmark(listing)}
        >
          <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-current')} />
        </Button>
      </div>

      <div className="space-y-2.5 p-3">
        <div>
          <h3 className="truncate text-sm font-semibold leading-tight text-white">
            {listing.address || 'Private listing'}
          </h3>
          {locationLine && (
            <p className="mt-0.5 truncate text-xs text-slate-300">{locationLine}</p>
          )}
        </div>

        <p className="text-base font-semibold tracking-tight text-white">{price}</p>

        {metrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300">
            {metrics.map((metric, index) => (
              <span key={metric.kind} className="inline-flex items-center gap-1.5">
                {index > 0 && <span className="text-white/25">•</span>}
                {metric.text}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_36px_36px_36px] gap-2 pt-1">
          <Button
            type="button"
            className="h-9 min-w-0 rounded-lg bg-blue-600 px-3 text-xs text-white hover:bg-blue-500"
            onClick={() => onOpenListing(listing)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Details
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-lg border-white/15 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
            title="Share listing"
            aria-label="Share listing"
            onClick={() => onShareListing(listing)}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-lg border-white/15 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
            title="Focus on map"
            aria-label="Focus on map"
            disabled={!mapped}
            onClick={() => onFocusOnMap(listing)}
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-lg border-white/15 bg-slate-950/55 text-slate-200 hover:bg-slate-800 hover:text-white"
            title={bookmarked ? 'Remove bookmark' : 'Bookmark listing'}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark listing'}
            onClick={() => onToggleBookmark(listing)}
          >
            <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-current text-primary')} />
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default SelectedPropertyCard
