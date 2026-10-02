import React from 'react'
import { cn } from '@/lib/utils'
import { PhotographerPickerMap } from './PhotographerPickerMap'
import type { ShootMapCoordinates } from '@/components/shoots/history/shootHistoryCoordinates'

export type PhotographerPickerMapShellProps = {
  /** Phone / short-landscape hint from parent; shell still uses CSS for iPad mid-widths. */
  isMobile: boolean
  photographer?: unknown
  photographerName?: string | null
  photographerId?: string | null
  jobCoords?: ShootMapCoordinates | null
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
 * Locked v6 chrome: Exclusive Listing Google map, tap popups, bottom strip,
 * right-list content unchanged (parent owns list).
 */
export function PhotographerPickerMapShell({
  isMobile,
  photographer,
  photographerName,
  photographerId,
  jobCoords = null,
  list,
  className,
}: PhotographerPickerMapShellProps) {
  const [compactTab, setCompactTab] = React.useState<'map' | 'list'>('list')
  // Prefer CSS max-lg for tabs; also honor parent isMobile for short-landscape phones.
  const useTabs = isMobile

  const map = (
    <PhotographerPickerMap
      photographer={photographer}
      photographerName={photographerName}
      photographerId={photographerId}
      jobCoords={jobCoords}
      className="h-full min-h-[560px]"
    />
  )

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col', className)}
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
          'grid min-h-0 flex-1 gap-3',
          // <1024: single pane (tabbed)
          'grid-cols-1',
          // 1024–1279: stack map then list (iPad landscape / mid laptops)
          'lg:grid-cols-1 lg:grid-rows-[minmax(320px,46%)_minmax(0,1fr)]',
          // ≥1280: equal-width side-by-side — map fills dialog body height
          'xl:grid-cols-2 xl:grid-rows-1 xl:items-stretch xl:gap-4',
        )}
      >
        <div
          className={cn(
            'min-h-0 min-w-0 h-full min-h-[560px] max-lg:min-h-[280px] lg:min-h-[320px] xl:min-h-[560px]',
            // Tab visibility below lg (and when parent forces mobile tabs)
            compactTab !== 'map' && 'max-lg:hidden',
            useTabs && compactTab !== 'map' && 'hidden',
            useTabs && compactTab === 'map' && 'block h-full min-h-[280px]',
            'lg:block',
          )}
        >
          {map}
        </div>
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col gap-3',
            compactTab !== 'list' && 'max-lg:hidden',
            useTabs && compactTab !== 'list' && 'hidden',
            useTabs && compactTab === 'list' && 'flex h-full',
            'lg:flex',
          )}
        >
          {list}
        </div>
      </div>
    </div>
  )
}
