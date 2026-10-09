import { cn } from '@/lib/utils'
import {
  bufferPillLabel,
  type PhotographerMapBuffer,
  type PhotographerMapFields,
} from './photographerMapFields'

export type PhotographerMapBottomStripProps = {
  name?: string | null
  fields: PhotographerMapFields
  className?: string
}

const bufferClass = (buffer: PhotographerMapBuffer) => {
  if (buffer === 'early') return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (buffer === 'tight') return 'border-amber-400/40 bg-amber-500/15 text-amber-800 dark:text-amber-200'
  return 'border-rose-400/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
}

const formatMinutes = (value: number | null) =>
  value === null ? null : `${Math.round(value)} min`

export function PhotographerMapBottomStrip({
  name,
  fields,
  className,
}: PhotographerMapBottomStripProps) {
  if (!name) return null

  const milesLabel = fields.miles !== null && Number.isFinite(fields.miles)
    ? `${fields.miles.toFixed(1)} mi`
    : null
  const lastToJob = formatMinutes(fields.travelMinutesLastToJob)
  const jobToNext = formatMinutes(fields.travelMinutesJobToNext)
  const hasTravel = Boolean(lastToJob || jobToNext)

  return (
    <div
      data-testid="photographer-map-bottom-strip"
      className={cn(
        'pointer-events-auto absolute inset-x-2 bottom-6 z-20 rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-lg dark:border-white/10 dark:bg-slate-950',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {milesLabel ? <span>{milesLabel}</span> : null}
            {hasTravel ? (
              <span className="truncate">
                {[lastToJob ? `last→job ${lastToJob}` : null, jobToNext ? `job→next ${jobToNext}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            ) : null}
            {!milesLabel && !hasTravel ? (
              <span>Map metrics unavailable</span>
            ) : null}
          </div>
        </div>
        {fields.buffer ? (
          <span
            data-testid="photographer-map-buffer-pill"
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              bufferClass(fields.buffer),
            )}
          >
            {bufferPillLabel(fields.buffer)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
