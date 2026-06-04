import { Bookmark } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  formatLocationLine,
  getMetricChips,
  resolveCardImage,
} from '@/lib/listing-presentation/card'
import type { ShowcaseListing } from '@/components/listings/ExclusiveListingsShowcase'

interface CompactListingRowProps {
  listing: ShowcaseListing
  resolveImageUrl: (value: string | null | undefined) => string | null
  selected: boolean
  bookmarked: boolean
  onSelect: (id: string) => void
  onToggleBookmark: (listing: ShowcaseListing) => void
}

export function CompactListingRow({
  listing,
  resolveImageUrl,
  selected,
  bookmarked,
  onSelect,
  onToggleBookmark,
}: CompactListingRowProps) {
  const imageSrc = resolveCardImage(listing.heroImage, resolveImageUrl)
  const locationLine = formatLocationLine(listing)
  const metrics = getMetricChips(listing)
  const metricLine = metrics.map((metric) => metric.text).join(' · ')

  return (
    <Card
      data-listing-id={listing.id}
      data-selected={selected ? 'true' : 'false'}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 rounded-xl border-slate-200/90 bg-white/62 p-2 text-left text-slate-950 shadow-none transition duration-200 hover:border-blue-400/60 hover:bg-white/90 dark:border-white/10 dark:bg-slate-950/38 dark:text-white dark:hover:border-blue-400/60 dark:hover:bg-slate-900/72',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
        selected && 'border-blue-500/70 bg-blue-500/10 ring-1 ring-blue-500/25 dark:border-blue-400/70 dark:ring-blue-400/30',
        listing.isListingHidden && 'opacity-70',
      )}
      onClick={() => onSelect(listing.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(listing.id)
        }
      }}
    >
      <div className="h-[64px] w-[82px] flex-shrink-0 overflow-hidden rounded-lg bg-slate-900">
        <img
          src={imageSrc}
          alt={listing.address || 'Private listing'}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-950 dark:text-white">
          {listing.address || 'Private listing'}
        </p>
        {locationLine && (
          <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-300">{locationLine}</p>
        )}
        {metricLine && (
          <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {metricLine}
          </p>
        )}
      </div>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        title={bookmarked ? 'Remove bookmark' : 'Bookmark listing'}
        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark listing'}
        className="h-8 w-8 flex-shrink-0 rounded-lg border border-slate-300/80 bg-white/70 text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        onClick={(event) => {
          event.stopPropagation()
          onToggleBookmark(listing)
        }}
      >
        <Bookmark className={cn('h-4 w-4', bookmarked && 'fill-current text-primary')} />
      </Button>
    </Card>
  )
}

export default CompactListingRow
