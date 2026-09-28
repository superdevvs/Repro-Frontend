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
    <div className="min-w-0 space-y-3" onClickCapture={onShootClickCapture}>
      <ShootHistoryCalendar
        {...calendarProps}
        filters={
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search calendar shoots"
                placeholder={calendarProps.hideClientDetails ? 'Search an address or photographer' : 'Search an address, client or photographer'}
                className="bg-background/60 pl-9 pr-9"
                value={search}
                onChange={(event) => onFilterChange('search', event.target.value)}
              />
              {search && <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1 h-8 w-8" aria-label="Clear calendar search" onClick={() => onFilterChange('search', '')}><X className="h-3.5 w-3.5" /></Button>}
            </div>
            <Select value={photographerId || 'all'} onValueChange={(value) => onFilterChange('photographerId', value)}>
              <SelectTrigger aria-label="Calendar photographer" className="bg-background/60 sm:w-52"><SelectValue placeholder="All photographers" /></SelectTrigger>
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
      {showUndatedNotice && <p className="px-1 text-xs text-muted-foreground">Requests without a scheduled date are available in List or Grid view.</p>}
    </div>
  )
}
