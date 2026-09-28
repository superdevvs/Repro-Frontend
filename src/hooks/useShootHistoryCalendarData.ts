import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/services/api'
import type { AvailableTab, FilterCollections, HistoryFiltersState, OperationalFiltersState } from '@/components/shoots/history/shootHistoryUtils'
import { EMPTY_FILTER_COLLECTION } from '@/components/shoots/history/shootHistoryUtils'
import type { ShootData, ShootHistoryRecord } from '@/types/shoots'
import type { UserData } from '@/types/auth'
import { calendarRangeParams, fetchCalendarPages, mapCalendarShoot, type ShootCalendarRange } from './shootHistoryCalendarData'

interface CalendarDataArgs {
  enabled: boolean
  activeTab: AvailableTab
  range?: ShootCalendarRange
  scheduledSubTab: 'all' | 'requested' | 'scheduled'
  operationalFilters: OperationalFiltersState
  historyFilters: HistoryFiltersState
  role: string | null | undefined
  user: UserData | null | undefined
  canViewAllShoots: boolean
  canViewHistory: boolean
  shouldHideClientDetails: boolean
  isEditor: boolean
  filterByRole: (shoot: ShootData, role: CalendarDataArgs['role'], user: CalendarDataArgs['user']) => boolean
}

interface CalendarState {
  key: string
  shoots: ShootData[]
  records: ShootHistoryRecord[]
  filters: FilterCollections
  loading: boolean
  error: string | null
}

const emptyState = { shoots: [], records: [], filters: EMPTY_FILTER_COLLECTION, loading: false, error: null }

function requestForCalendar(args: CalendarDataArgs) {
  if (!args.range) return null
  const isHistory = args.activeTab === 'history'
  const filters = isHistory ? args.historyFilters : args.operationalFilters
  const range = calendarRangeParams(args.range)
  const params: Record<string, unknown> = { ...range, sort: 'date_asc', per_page: isHistory ? 200 : 50 }
  if (filters.search) params.search = filters.search
  if (!args.shouldHideClientDetails && filters.clientId) params.client_id = filters.clientId
  if (filters.photographerId) params.photographer_id = filters.photographerId
  if (filters.services.length) params.services = filters.services
  if (isHistory) {
    params.group_by = 'shoot'
    const history = args.historyFilters
    if (history.completedStart) params.completed_start = history.completedStart
    if (history.completedEnd) params.completed_end = history.completedEnd
  } else {
    let tab = args.activeTab
    if (args.isEditor && (tab === 'editing' || tab === 'scheduled')) tab = 'completed'
    if (args.isEditor && tab === 'edited') tab = 'delivered'
    params.tab = tab
    params.include_files = 'false'
    params.no_cache = 'true'
    if (tab === 'scheduled' && args.scheduledSubTab !== 'all') params.scheduled_status = args.scheduledSubTab
    if (args.operationalFilters.address) params.address = args.operationalFilters.address
  }
  return { endpoint: isHistory ? '/shoots/history' : '/shoots', params, range, isHistory }
}

/** Calendar data is separate from page data so switching views never reuses a partial page. */
export function useShootHistoryCalendarData(args: CalendarDataArgs) {
  const argsRef = useRef(args)
  argsRef.current = args
  const key = JSON.stringify({
    enabled: args.enabled, range: args.range, tab: args.activeTab,
    subTab: args.scheduledSubTab,
    filters: args.activeTab === 'history' ? args.historyFilters : args.operationalFilters,
    role: args.role, user: args.user, all: args.canViewAllShoots,
    history: args.canViewHistory, hideClient: args.shouldHideClientDetails, editor: args.isEditor,
  })
  const keyRef = useRef(key)
  keyRef.current = key
  const abortRef = useRef<AbortController | null>(null)
  const [state, setState] = useState<CalendarState>({ key: '', ...emptyState })

  const refresh = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const current = argsRef.current
    const scope = keyRef.current
    const isCurrent = () => !controller.signal.aborted && abortRef.current === controller && keyRef.current === scope
    if (!current.enabled || (current.activeTab === 'history' && !current.canViewHistory)) {
      setState({ key: scope, ...emptyState })
      return
    }
    setState({ key: scope, ...emptyState, loading: true })
    try {
      const request = requestForCalendar(current)
      // The parent supplies the complete visible range, including month spillover.
      // Wait for it instead of making an unbounded request.
      if (!request) return
      const result = await fetchCalendarPages(async (page) => {
        const response = await apiClient.get(request.endpoint, { params: { ...request.params, page }, signal: controller.signal })
        return response.data
      }, controller.signal)
      if (!isCurrent()) return
      let shoots = result.rows.map((row) => mapCalendarShoot(row, request.isHistory))
      if (!request.isHistory && !current.canViewAllShoots) shoots = shoots.filter((shoot) => current.filterByRole(shoot, current.role, current.user))
      const visible = new Set(shoots.filter((shoot) => shoot.scheduledDate >= request.range.scheduled_start && shoot.scheduledDate <= request.range.scheduled_end).map((shoot) => shoot.id))
      const filters = current.shouldHideClientDetails ? { ...result.filters, clients: [] } : result.filters
      setState({
        key: scope, shoots: shoots.filter((shoot) => visible.has(shoot.id)),
        records: request.isHistory ? result.rows.filter((row) => visible.has(String(row.id))) as unknown as ShootHistoryRecord[] : [],
        filters, loading: false, error: null,
      })
    } catch (error) {
      if (!isCurrent()) return
      setState({ key: scope, ...emptyState, error: error instanceof Error ? error.message : 'Unable to load the calendar. Please try again.' })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [])

  useEffect(() => {
    if (args.enabled) void refresh()
    return () => { abortRef.current?.abort() }
  }, [key, args.enabled, refresh])

  // This synchronous scope check also prevents a one-frame flash of the old month.
  const visibleState = state.key === key ? state : { key, ...emptyState, loading: args.enabled }
  return { ...visibleState, refresh }
}
