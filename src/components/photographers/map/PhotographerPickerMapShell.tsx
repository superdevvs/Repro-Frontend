import React from 'react'
import { cn } from '@/lib/utils'
import { PhotographerPickerMap } from './PhotographerPickerMap'
import type { PhotographerListEntry } from './buildPhotographerMapMarkers'
import type { ShootMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'

/** Landscape → 50/50 even under xl (iPad landscape ~1024–1180). */
export const PICKER_LANDSCAPE_QUERY = '(orientation: landscape)'
/** Shorter landscape heights: tighten chrome so the list stays readable. */
export const PICKER_COMPACT_LANDSCAPE_QUERY =
  '(orientation: landscape) and (max-height: 900px)'

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

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia(query).matches
  })

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * Responsive layout:
 * - Phone / forced mobile (isMobile): Map/List tabs
 * - Portrait <lg: Map/List tabs (CSS)
 * - Portrait lg–xl: stacked map above list
 * - Portrait xl+: equal-width 50/50
 * - Landscape (any width, non-mobile): equal-width 50/50 — iPad landscape never stacks
 *
 * Parent Dialog wrappers use photographerPickerDialogClasses: edge-to-edge
 * ~100dvh×100vw below xl (iPad portrait/landscape); inset modal on xl+.
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
  const [mapVisited, setMapVisited] = React.useState(false)
  const isLandscape = useMatchMedia(PICKER_LANDSCAPE_QUERY)
  const compactChrome = useMatchMedia(PICKER_COMPACT_LANDSCAPE_QUERY)
  /** Desktop Dialog path in landscape → always side-by-side (even under xl). */
  const sideBySide = !useTabs && isLandscape

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

  const layout = useTabs ? 'tabs' : sideBySide ? 'side-by-side' : 'responsive'

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-testid="photographer-picker-map-shell"
      data-layout={layout}
      data-orientation={isLandscape ? 'landscape' : 'portrait'}
      data-compact-chrome={compactChrome ? 'true' : 'false'}
    >
      <div
        className={cn(
          'mb-2 shrink-0 gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900/60',
          useTabs ? 'flex' : sideBySide ? 'hidden' : 'hidden max-lg:flex',
          !sideBySide && 'lg:hidden',
          compactChrome && 'mb-1.5',
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
          onClick={() => { setMapVisited(true); setCompactTab('map') }}
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
            : sideBySide
              ? cn(
                  'grid grid-cols-2 grid-rows-1 items-stretch',
                  compactChrome ? 'gap-2' : 'gap-3',
                )
              : cn(
                  // Portrait lg–xl: stacked map then list
                  'lg:grid lg:gap-3',
                  'lg:grid-cols-1 lg:grid-rows-[minmax(220px,38%)_minmax(0,1fr)]',
                  // Portrait xl+: equal-width side-by-side
                  'xl:grid-cols-2 xl:grid-rows-1 xl:items-stretch xl:gap-4',
                ),
        )}
      >
        <div
          className={cn(
            'min-h-0 min-w-0',
            useTabs
              ? cn('min-h-0 flex-1', compactTab !== 'map' && 'hidden')
              : sideBySide
                ? 'h-full'
                : cn(
                    // Fill dialog below lg via absolute; grid cell at lg+
                    'absolute inset-0 lg:static lg:h-full',
                    compactTab !== 'map' && 'max-lg:hidden',
                    'lg:block',
                  ),
          )}
        >
          {(!useTabs || mapVisited) ? map : null}
        </div>
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col overflow-hidden',
            compactChrome ? 'gap-2' : 'gap-3',
            // Compact list chrome titles/footers when landscape height is tight
            compactChrome &&
              '[&_[class*="text-xl"]]:text-lg [&_[class*="pt-4"]]:pt-2.5 [&_[class*="space-y-3"]]:space-y-2',
            useTabs
              ? cn('min-h-0 flex-1', compactTab !== 'list' && 'hidden')
              : sideBySide
                ? 'flex'
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
