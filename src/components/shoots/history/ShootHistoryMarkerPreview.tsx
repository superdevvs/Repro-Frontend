import React from 'react'
import { ArrowUpRight, CalendarClock, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MapMarker } from './shootHistoryUtils'
import { getShootPlaceholderSrc } from './shootHistoryUtils'

interface ShootHistoryMarkerPreviewProps {
  marker: MapMarker
  onDismiss?: () => void
  theme: 'light' | 'dark'
}

const formatStatusLabel = (status?: string) => {
  const normalized = status?.trim().replace(/[_-]+/g, ' ')
  if (!normalized) return 'Shoot'
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase())
}

export function ShootHistoryMarkerPreview({
  marker,
  onDismiss,
  theme,
}: ShootHistoryMarkerPreviewProps) {
  const fallbackImage = getShootPlaceholderSrc(theme)
  const imageUrl = marker.imageUrl || fallbackImage
  const canOpen = typeof marker.onOpen === 'function'

  return (
    <article
      className={cn(
        'group relative block w-64 overflow-hidden rounded-2xl border border-border bg-card text-left text-card-foreground shadow-lg',
        'transition duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-xl',
        !canOpen && 'cursor-default',
      )}
      data-testid="shoot-history-marker-preview"
    >
      {canOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          aria-label={`View Overview for ${marker.address}`}
          onClick={marker.onOpen}
        />
      ) : null}
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-20 h-8 w-8 rounded-full bg-slate-950/75 text-white shadow-sm backdrop-blur hover:bg-slate-950 hover:text-white"
          aria-label="Close property preview"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      <div className="relative h-28 w-full overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt={marker.address || 'Shoot property'}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(event) => {
            const image = event.currentTarget
            if (image.dataset.fallbackApplied === 'true') return
            image.dataset.fallbackApplied = 'true'
            image.src = fallbackImage
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-slate-950/75 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md">
          {formatStatusLabel(marker.status)}
        </span>
      </div>

      <div className="space-y-2.5 p-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {marker.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {marker.address}
          </p>
        </div>

        {marker.subtitle ? (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{marker.subtitle}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Property location</span>
          </div>
        )}

        {canOpen ? (
          <span className="flex items-center justify-between border-t border-border/70 pt-2.5 text-xs font-semibold text-primary">
            View Overview
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </article>
  )
}

export default ShootHistoryMarkerPreview
