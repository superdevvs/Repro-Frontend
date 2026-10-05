import { Children, Fragment, type ReactNode } from 'react'
import { format, isSameDay, addDays } from 'date-fns'
import { parseLocalYmd } from '@/utils/shootLocalDate'

/** Keep the server's paginated order and label each consecutive scheduled day. */
export function ShootHistoryDateList({ dates, children }: { dates: (string | null | undefined)[]; children: ReactNode }) {
  const rows = Children.toArray(children)
  const today = new Date()
  return <div className="space-y-3">
    {rows.map((row, index) => {
      const day = dates[index] ?? null
      const beginsDay = index === 0 || day !== (dates[index - 1] ?? null)
      const date = parseLocalYmd(day)
      const label = !day || Number.isNaN(date.getTime()) ? 'Date not set'
        : isSameDay(date, today) ? 'Today'
        : isSameDay(date, addDays(today, 1)) ? 'Tomorrow'
        : format(date, 'EEEE, d MMMM yyyy')
      let count = 1
      if (beginsDay) while (index + count < rows.length && (dates[index + count] ?? null) === day) count++
      return <Fragment key={index}>
        {beginsDay && <h3 data-shoot-date-separator={day ?? 'undated'} className="flex items-center gap-3 pt-3 text-sm font-medium text-muted-foreground">
          <span>{label} • {count} {count === 1 ? 'shoot' : 'shoots'}</span>
          <span className="h-px flex-1 bg-border/60" />
        </h3>}
        {row}
      </Fragment>
    })}
  </div>
}
