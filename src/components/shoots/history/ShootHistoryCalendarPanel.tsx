import { Search, X } from 'lucide-react'
import type { MouseEventHandler } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShootHistoryCalendar, type CalendarViewMode } from './calendar'
import type { FilterCollections } from './shootHistoryUtils'
import type { ShootData } from '@/types/shoots'

type Props = {
  shoots: ShootData[]
  view: CalendarViewMode
  date: string
  onViewChange: (view: CalendarViewMode) => void
  onDateChange: (date: string) => void
  onShootSelect: (shoot: ShootData) => void
  loading: boolean
  error: string | null
  onRetry: () => void
  hideClientDetails: boolean
  canViewPrices: boolean
  search: string
  photographerId: string
  options: FilterCollections
  onFilterChange: (key: 'search' | 'photographerId', value: string) => void
  showUndatedNotice: boolean
  onShootClickCapture: MouseEventHandler<HTMLDivElement>
}

export function ShootHistoryCalendarPanel({
  search, photographerId, options, onFilterChange, showUndatedNotice, onShootClickCapture, ...calendarProps
}: Props) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden xl:h-full" onClickCapture={onShootClickCapture}>
      <ShootHistoryCalendar
        {...calendarProps}
        filters={
          <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:gap-2">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:h-4 sm:w-4" />
              <Input
                aria-label="Search calendar shoots"
                placeholder={calendarProps.hideClientDetails ? 'Search an address or photographer' : 'Search an address, client or photographer'}
                className="h-8 bg-background/60 pl-8 pr-8 text-sm sm:h-10 sm:pl-9 sm:pr-9"
                value={search}
                onChange={(event) => onFilterChange('search', event.target.value)}
              />
              {search && <Button type="button" size="icon" variant="ghost" className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 sm:right-1 sm:top-1 sm:h-8 sm:w-8 sm:translate-y-0" aria-label="Clear calendar search" onClick={() => onFilterChange('search', '')}><X className="h-3.5 w-3.5" /></Button>}
            </div>
            <Select value={photographerId || 'all'} onValueChange={(value) => onFilterChange('photographerId', value)}>
              <SelectTrigger aria-label="Calendar photographer" className="h-8 bg-background/60 text-sm sm:h-10 sm:w-52"><SelectValue placeholder="All photographers" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All photographers</SelectItem>
                {options.photographers.filter((entry) => entry.id || entry.name).map((entry) => (
                  <SelectItem key={entry.id ?? entry.name} value={String(entry.id ?? entry.name)}>{entry.name ?? 'Unknown'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      {showUndatedNotice && <p className="flex-shrink-0 px-1 text-xs text-muted-foreground">Requests without a scheduled date are available in List or Grid view.</p>}
    </div>
  )
}
