import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_HISTORY_FILTERS, DEFAULT_OPERATIONAL_FILTERS } from '@/components/shoots/history/shootHistoryUtils'
import { useShootHistoryData, type UseShootHistoryDataArgs } from './useShootHistoryData'

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn() }))
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get }, getApiHeaders: () => ({}) }))
vi.mock('@/hooks/useShootHistoryMapGeocoding', () => ({ useShootHistoryMapGeocoding: () => ({ geoCache: {}, setGeoCache: vi.fn() }) }))

const range = { start: '2026-09-28', end: '2026-10-04' }
const args: UseShootHistoryDataArgs = {
  toast: mocks.toast, navigate: vi.fn(), role: 'admin', user: null, activeTab: 'scheduled', shootSort: 'next_up',
  operationalFilters: DEFAULT_OPERATIONAL_FILTERS, historyFilters: DEFAULT_HISTORY_FILTERS,
  viewMode: 'calendar', calendarRange: range, canViewAllShoots: true, canViewHistory: true,
  canViewInvoice: false, shouldHideClientDetails: false, isSuperAdmin: false, isAdmin: true,
  isEditingManager: false, isPhotographer: false, isEditor: false, formatDatePref: String, formatTime: String,
}
const shoot = (id: number, date = range.start) => ({ id, scheduled_date: date, time: '10:00:00', status: 'scheduled' })
const payload = (rows: unknown[], total = rows.length, page = 1, perPage = 12) => ({ data: { data: rows, meta: { count: total, total, current_page: page, per_page: perPage, filters: { clients: [], photographers: [], services: [] } } } })
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(payload([shoot(1)])) })
afterEach(cleanup)

describe('calendar range data integration', () => {
  it('loads all pages atomically using actual page sizes and keeps existing status filters', async () => {
    const second = deferred<ReturnType<typeof payload>>()
    mocks.get.mockImplementation((_path, config) => config.params.page === 1 ? Promise.resolve(payload(Array.from({ length: 12 }, (_, i) => shoot(i + 1)), 13)) : second.promise)
    const props = { ...args, scheduledSubTab: 'requested' as const, operationalFilters: { ...DEFAULT_OPERATIONAL_FILTERS, search: 'Main', photographerId: '7', services: ['HDR'], dateRange: 'custom' as const, scheduledStart: '2025-01-01', scheduledEnd: '2025-01-02' } }
    const { result } = renderHook(() => useShootHistoryData(props))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2))
    expect(result.current.loading).toBe(true)
    expect(result.current.calendarShoots).toEqual([])
    expect(mocks.get.mock.calls[0][1].params).toMatchObject({ page: 1, per_page: 50, tab: 'scheduled', scheduled_status: 'requested', sort: 'date_asc', scheduled_start: range.start, scheduled_end: range.end, search: 'Main', photographer_id: '7', services: ['HDR'], include_files: 'false' })
    await act(async () => { second.resolve(payload([shoot(13)], 13, 2)); await second.promise })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.operationalData).toHaveLength(13)
    expect(result.current.calendarShoots).toHaveLength(13)
    expect(result.current.calendarError).toBeNull()
  })

  it('clears stale range data immediately and ignores a late response after navigation', async () => {
    const old = deferred<ReturnType<typeof payload>>()
    const next = deferred<ReturnType<typeof payload>>()
    let oldSignal!: AbortSignal
    mocks.get.mockImplementation((_path, config) => { if (config.params.scheduled_start === range.start) { oldSignal = config.signal; return old.promise } return next.promise })
    const { result, rerender } = renderHook(useShootHistoryData, { initialProps: args })
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1))
    const nextRange = { start: '2026-10-05', end: '2026-10-11' }
    rerender({ ...args, calendarRange: nextRange })
    expect(oldSignal.aborted).toBe(true)
    expect(result.current.calendarShoots).toEqual([])
    await act(async () => { old.resolve(payload([shoot(99)])); await old.promise })
    expect(result.current.loading).toBe(true)
    expect(result.current.calendarShoots).toEqual([])
    await act(async () => { next.resolve(payload([shoot(2, nextRange.start)])); await next.promise })
    await waitFor(() => expect(result.current.calendarShoots.map((item) => item.id)).toEqual(['2']))
  })

  it('does not keep a partial month when a later page fails and retries the complete range', async () => {
    mocks.get.mockResolvedValueOnce(payload(Array.from({ length: 12 }, (_, i) => shoot(i)), 13)).mockRejectedValueOnce(new Error('Connection interrupted'))
    const { result } = renderHook(() => useShootHistoryData(args))
    await waitFor(() => expect(result.current.calendarError).toBe('Connection interrupted'))
    expect(result.current.calendarShoots).toEqual([])
    expect(result.current.loading).toBe(false)
    mocks.get.mockResolvedValue(payload([shoot(9)]))
    await act(async () => { await result.current.refreshActiveTabData() })
    expect(result.current.calendarError).toBeNull()
    expect(result.current.calendarShoots.map((item) => item.id)).toEqual(['9'])
  })

  it('loads raw History calendar records, preserves completed filters, and exports the visible range', async () => {
    mocks.get.mockResolvedValue(payload([{ id: 3, scheduledDate: range.start, time: '1:30 PM', timezone: 'America/New_York', address: { street: '3 Main' }, financials: { totalQuote: 200 } }]))
    const props: UseShootHistoryDataArgs = { ...args, activeTab: 'history', historyFilters: { ...DEFAULT_HISTORY_FILTERS, viewAs: 'calendar', dateRange: 'custom', scheduledStart: '2025-01-01', scheduledEnd: '2025-01-02', completedStart: '2026-09-01' } }
    const { result } = renderHook(() => useShootHistoryData(props))
    await waitFor(() => expect(result.current.calendarShoots).toHaveLength(1))
    expect(mocks.get.mock.calls[0][0]).toBe('/shoots/history')
    expect(mocks.get.mock.calls[0][1].params).toMatchObject({ group_by: 'shoot', per_page: 200, scheduled_start: range.start, scheduled_end: range.end, completed_start: '2026-09-01' })
    expect(mocks.get.mock.calls[0][1].params).not.toHaveProperty('date_range')
    expect(result.current.calendarShoots[0]).toMatchObject({ time: '13:30', location: { address: '3 Main' } })
    expect(result.current.historyRecords).toHaveLength(1)
    expect(result.current.buildHistoryParams()).toMatchObject({ scheduled_start: range.start, scheduled_end: range.end, completed_start: '2026-09-01' })
    expect(result.current.buildHistoryParams()).not.toHaveProperty('custom_start')
  })

  it('aborts a calendar load on exit and restores the existing single-page list request', async () => {
    const old = deferred<ReturnType<typeof payload>>()
    mocks.get.mockImplementation((_path, config) => config.params.per_page === 50 ? old.promise : Promise.resolve(payload([shoot(4)], 30)))
    const { result, rerender } = renderHook(useShootHistoryData, { initialProps: args })
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1))
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    rerender({ ...args, viewMode: 'list', calendarRange: undefined })
    expect(signal.aborted).toBe(true)
    await waitFor(() => expect(result.current.operationalData.map((item) => item.id)).toEqual(['4']))
    await act(async () => { old.resolve(payload([shoot(99)])); await old.promise })
    expect(result.current.operationalData.map((item) => item.id)).toEqual(['4'])
    expect(mocks.get.mock.calls.at(-1)?.[1].params).toMatchObject({ page: 1, per_page: 12, sort: 'next_up' })
    expect(mocks.get).toHaveBeenCalledTimes(2)
  })

  it('aborts on unmount and does not request another page or report an error', async () => {
    const pending = deferred<ReturnType<typeof payload>>()
    mocks.get.mockReturnValue(pending.promise)
    const { unmount } = renderHook(() => useShootHistoryData(args))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1))
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { pending.resolve(payload([shoot(1)], 30)); await pending.promise })
    expect(mocks.get).toHaveBeenCalledTimes(1)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('does not fetch History calendar data without the existing History permission', async () => {
    const { result } = renderHook(() => useShootHistoryData({ ...args, activeTab: 'history', canViewHistory: false, historyFilters: { ...DEFAULT_HISTORY_FILTERS, viewAs: 'calendar' } }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.get).not.toHaveBeenCalled()
    expect(result.current.calendarShoots).toEqual([])
  })
})
