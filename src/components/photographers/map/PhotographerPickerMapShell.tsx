import React from 'react'
import { cn } from '@/lib/utils'
import { PhotographerPickerMap } from './PhotographerPickerMap'
import type { PhotographerListEntry } from './buildPhotographerMapMarkers'
import type { ShootMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'

export type PhotographerPickerMapShellProps = {
  /** Phone / short-landscape hint from parent; shell still uses CSS for iPad mid-widths. */
  isMobile: boolean
  photographer?: unknown
  photographerName?: string | null
  photographerId?: string | null
  photographers?: ReadonlyArray<PhotographerListEntry | Record<string, unknown> | unknown> | null
  jobCoords?: ShootMapCoordinates | null
  onSelectPhotographer?: (photographerId: string | null) => void
  /** Exact current list chrome (title/filters/results/footer stay with parent). */
  list: React.ReactNode
  className?: string
}

/**
 * Responsive layout (Tailwind defaults):
 * - max-lg (<1024): Map/List tabs — phones + iPad portrait (~768–834)
 * - lg–xl (1024–1279): stacked map above list — iPad landscape / ~1180 laptops
 * - xl+ (≥1280): equal-width 50/50 — 1366 / 1440 / 1920 desktops
 *
 * Map fills the pane via h-full/min-h-0 (no hard 560px min) so stacked tablet
 * dialogs keep list + specialist footer inside the modal.
 */
export function PhotographerPickerMapShell({
  isMobile,
  photographer,
  photographerName,
  photographerId,
  photographers = [],
  jobCoords = null,
  onSelectPhotographer,
  list,
  className,
}: PhotographerPickerMapShellProps) {
  const [compactTab, setCompactTab] = React.useState<'map' | 'list'>('list')
  const useTabs = isMobile

  const map = (
    <PhotographerPickerMap
      photographer={photographer}
      photographerName={photographerName}
      photographerId={photographerId}
      photographers={photographers}
      jobCoords={jobCoords}
      onSelectPhotographer={onSelectPhotographer}
      className="h-full min-h-0 w-full"
    />
  )

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-testid="photographer-picker-map-shell"
      data-layout={useTabs ? 'tabs' : 'responsive'}
    >
      <div
        className={cn(
          'mb-2 shrink-0 gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/60',
          useTabs ? 'flex' : 'hidden max-lg:flex',
          'lg:hidden',
        )}
      >
        <button
          type="button"
          className={cn(
            'flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            compactTab === 'map'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-200/80 dark:text-slate-300',
          )}
          aria-pressed={compactTab === 'map'}
          onClick={() => setCompactTab('map')}
        >
          Map
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            compactTab === 'list'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:bg-slate-200/80 dark:text-slate-300',
          )}
          aria-pressed={compactTab === 'list'}
          onClick={() => setCompactTab('list')}
        >
          List
        </button>
      </div>

      <div
        className={cn(
          'relative min-h-0 flex-1',
          useTabs
            ? 'flex flex-col'
            : cn(
                // lg–xl: stacked map then list (iPad landscape height budget)
                'lg:grid lg:gap-3',
                'lg:grid-cols-1 lg:grid-rows-[minmax(220px,38%)_minmax(0,1fr)]',
                // ≥1280: equal-width side-by-side
                'xl:grid-cols-2 xl:grid-rows-1 xl:items-stretch xl:gap-4',
              ),
        )}
      >
        <div
          className={cn(
            'min-h-0 min-w-0',
            useTabs
              ? cn('min-h-0 flex-1', compactTab !== 'map' && 'hidden')
              : cn(
                  // Fill dialog below lg via absolute; grid cell at lg+
                  'absolute inset-0 lg:static lg:h-full',
                  compactTab !== 'map' && 'max-lg:hidden',
                  'lg:block',
                ),
          )}
        >
          {map}
        </div>
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden',
            useTabs
              ? cn('min-h-0 flex-1', compactTab !== 'list' && 'hidden')
              : cn(
                  'absolute inset-0 lg:static',
                  compactTab !== 'list' && 'max-lg:hidden',
                  'lg:flex',
                ),
          )}
        >
          {list}
        </div>
      </div>
    </div>
  )
}
