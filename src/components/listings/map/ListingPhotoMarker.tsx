import type { ButtonHTMLAttributes } from 'react'
import { DEFAULT_PLACEHOLDER_IMAGE } from '@/lib/listing-presentation/card'

interface ListingPhotoMarkerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  address: string
  imageUrl: string
  label: string
  selected: boolean
  showLabel: boolean
  count: number
}

/** A small property photo anchored to its location, shared by both map providers. */
export function ListingPhotoMarker({
  address, imageUrl, label, selected, showLabel, count, ...props
}: ListingPhotoMarkerProps) {
  return (
    <button
      {...props}
      type="button"
      aria-label={`Select ${address}`}
      aria-pressed={selected}
      className="listing-photo-marker"
      data-selected={selected}
    >
      <img src={imageUrl} alt="" draggable={false} onError={(event) => {
        const image = event.currentTarget
        if (!image.src.endsWith(DEFAULT_PLACEHOLDER_IMAGE)) image.src = DEFAULT_PLACEHOLDER_IMAGE
      }} />
      {count > 1 && <span className="listing-photo-count">{count}</span>}
      {showLabel && <span className="listing-photo-label">{label}</span>}
    </button>
  )
}
