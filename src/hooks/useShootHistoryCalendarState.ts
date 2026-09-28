import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCalendarDateRange, getCalendarToday, type CalendarViewMode } from '@/components/shoots/history/calendar'
import type { AvailableTab, HistoryFiltersState, ShootHistoryDisplayMode } from '@/components/shoots/history/shootHistoryUtils'

export function useShootHistoryCalendarState({ activeTab, viewMode, historyFilters, historySubTab }: {
  activeTab: AvailableTab
  viewMode: ShootHistoryDisplayMode
  historyFilters: HistoryFiltersState
  historySubTab: 'all' | 'mls-queue'
}) {
  const [searchParams] = useSearchParams()
  const [view, onViewChange] = useState<CalendarViewMode>(() => {
    const requested = searchParams.get('calendarView')
    return requested === 'month' || requested === 'day' ? requested : 'week'
  })
  const [date, onDateChange] = useState(() => {
    const requested = searchParams.get('calendarDate') ?? ''
    // Keep a date-only value, independent of the browser's UTC offset.
    if (/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      const parsed = new Date(`${requested}T12:00:00`)
      if (!Number.isNaN(parsed.getTime()) &&
          parsed.getFullYear() === Number(requested.slice(0, 4)) &&
          parsed.getMonth() + 1 === Number(requested.slice(5, 7)) &&
          parsed.getDate() === Number(requested.slice(8, 10))) return requested
    }
    return getCalendarToday()
  })
  const active = activeTab === 'history'
    ? historySubTab === 'all' && historyFilters.groupBy === 'shoot' && historyFilters.viewAs === 'calendar'
    : viewMode === 'calendar'
  const range = useMemo(() => active ? getCalendarDateRange(date, view) : undefined, [active, date, view])
  return { active, range, view, date, onViewChange, onDateChange }
}
