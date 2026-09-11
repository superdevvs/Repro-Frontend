import * as React from 'react'
import { cn } from '@/lib/utils'

// Pin sizes (px). The selected pin is enlarged relative to the others (R10.6).
const PIN_SIZE_UNSELECTED = 34
const PIN_SIZE_SELECTED = 46

interface CustomPinProps {
  label: string
  showLabel: boolean
  selected: boolean
  color: string
  count: number
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/**
 * Presentational custom pin: a teardrop/location-pin SVG with an optional label
 * chip above it. Rendered imperatively into each Leaflet marker element.
 */
export function StandardListingPin({ label, showLabel, selected, color, count, onClick }: CustomPinProps) {
  const size = selected ? PIN_SIZE_SELECTED : PIN_SIZE_UNSELECTED

  return (
    <div className="flex select-none flex-col items-center" style={{ pointerEvents: 'auto' }}>
      {showLabel && (
        <span
          className="mb-1 max-w-[140px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow-md"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        aria-label={`Select ${label}`}
        aria-pressed={selected}
        onClick={onClick}
        className={cn(
          'group relative block cursor-pointer border-0 bg-transparent p-0 leading-none outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5',
        )}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            filter: 'drop-shadow(0 6px 10px rgba(15, 23, 42, 0.35))',
            display: 'block',
          }}
        >
          {/* Teardrop / location-pin body */}
          <path
            d="M12 1.5c-4.14 0-7.5 3.36-7.5 7.5 0 5.34 6.43 12.31 6.71 12.6a1.08 1.08 0 0 0 1.58 0c.28-.29 6.71-7.26 6.71-12.6 0-4.14-3.36-7.5-7.5-7.5Z"
            fill={color}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
          {/* Inner dot */}
          <circle cx="12" cy="9" r="3" fill="#ffffff" />
        </svg>
        {count > 1 ? (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 px-1 text-[10px] font-bold leading-none text-white shadow-md">
            {count}
          </span>
        ) : null}
      </button>
    </div>
  )
}
