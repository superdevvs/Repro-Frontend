import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_HISTORY_FILTERS,
  DEFAULT_OPERATIONAL_FILTERS,
} from '@/components/shoots/history/shootHistoryUtils'
import { useShootHistoryData, type UseShootHistoryDataArgs } from './useShootHistoryData'

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn() }))
vi.mock('@/services/api', () => ({
  apiClient: { get: mocks.get },
  getApiHeaders: () => ({}),
  getImpersonatedUserId: () => null,
}))
vi.mock('@/hooks/useShootHistoryMapGeocoding', () => ({
  useShootHistoryMapGeocoding: () => ({ geoCache: {}, setGeoCache: vi.fn() }),
}))

const baseArgs: UseShootHistoryDataArgs = {
  toast: mocks.toast,
  navigate: vi.fn(),
  role: 'admin',
  user: null,
  activeTab: 'scheduled',
  shootSort: 'next_up',
  operationalFilters: DEFAULT_OPERATIONAL_FILTERS,
  historyFilters: DEFAULT_HISTORY_FILTERS,
  viewMode: 'list',
  canViewAllShoots: true,
  canViewHistory: true,
  canViewInvoice: false,
  shouldHideClientDetails: false,
  isSuperAdmin: false,
  isAdmin: true,
  isEditingManager: false,
  isPhotographer: false,
  isEditor: false,
  formatDatePref: () => '',
  formatTime: (value) => value,
}

const payload = (ids: number[], page = 1) => ({
  data: {
    data: ids.map((id) => ({ id, scheduled_date: '2026-09-28', time: '10:00:00', status: 'scheduled' })),
    meta: { current_page: page, per_page: 12, total: 40 },
  },
})

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  mocks.get.mockResolvedValue(payload([1]))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('Shoot History search/filter page reset', () => {
  it('debounces search 250ms, resets to page 1, and does not spam the API while typing', async () => {
    const { result, rerender } = renderHook((args: UseShootHistoryDataArgs) => useShootHistoryData(args), {
      wrapper: QueryWrapper,
      initialProps: baseArgs,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setOperationalPage(2))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
    ))
    mocks.get.mockClear()

    rerender({ ...baseArgs, operationalFilters: { ...DEFAULT_OPERATIONAL_FILTERS, search: 'ke' } })
    rerender({ ...baseArgs, operationalFilters: { ...DEFAULT_OPERATIONAL_FILTERS, search: 'kev' } })
    rerender({ ...baseArgs, operationalFilters: { ...DEFAULT_OPERATIONAL_FILTERS, search: 'kevin' } })

    expect(mocks.get).not.toHaveBeenCalled()
    expect(result.current.operationalPage).toBe(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(249)
    })
    expect(mocks.get).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await waitFor(() => expect(result.current.operationalPage).toBe(1))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ search: 'kevin', page: 1 }) }),
    ))
    // Prefetch may request page 2 of the *filtered* result; the live page must stay 1.
    expect(result.current.operationalPage).toBe(1)
    const firstKevin = mocks.get.mock.calls.find(([path, config]) => path === '/shoots' && config?.params?.search === 'kevin')
    expect(firstKevin?.[1]?.params?.page).toBe(1)
  })

  it('resets operational page to 1 when a non-search list filter changes', async () => {
    const { result, rerender } = renderHook((args: UseShootHistoryDataArgs) => useShootHistoryData(args), {
      wrapper: QueryWrapper,
      initialProps: baseArgs,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setOperationalPage(2))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
    ))
    mocks.get.mockClear()
    rerender({
      ...baseArgs,
      operationalFilters: { ...DEFAULT_OPERATIONAL_FILTERS, photographerId: '7' },
    })
    await waitFor(() => expect(result.current.operationalPage).toBe(1))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ photographer_id: '7', page: 1 }) }),
    ))
  })

  it('resets history page to 1 when history search debounces', async () => {
    const args: UseShootHistoryDataArgs = { ...baseArgs, activeTab: 'history', shootSort: 'date_desc' }
    mocks.get.mockResolvedValue({
      data: { data: [{ id: 3, scheduled_date: '2026-09-28' }], meta: { current_page: 1, per_page: 12, total: 20 } },
    })
    const { result, rerender } = renderHook((props: UseShootHistoryDataArgs) => useShootHistoryData(props), {
      wrapper: QueryWrapper,
      initialProps: args,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setHistoryPage(2))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots/history',
      expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
    ))
    mocks.get.mockClear()
    rerender({ ...args, historyFilters: { ...DEFAULT_HISTORY_FILTERS, search: 'kevin' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    await waitFor(() => expect(result.current.historyPage).toBe(1))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots/history',
      expect.objectContaining({ params: expect.objectContaining({ search: 'kevin', page: 1 }) }),
    ))
  })

  it('ignores a stale slower page=2 response after a newer page=1 search', async () => {
    let resolvePage2: ((value: unknown) => void) | null = null
    const page2Promise = new Promise((resolve) => {
      resolvePage2 = resolve
    })

    mocks.get.mockImplementation((_path: string, config?: { params?: { page?: number; search?: string }; signal?: AbortSignal }) => {
      const page = config?.params?.page ?? 1
      const search = config?.params?.search
      if (page === 2 && !search) {
        return page2Promise.then(() => {
          if (config?.signal?.aborted) {
            const error = new Error('canceled')
            error.name = 'CanceledError'
            ;(error as { code?: string }).code = 'ERR_CANCELED'
            throw error
          }
          return payload([99, 98], 2)
        })
      }
      if (search === 'kevin' && page === 1) {
        return Promise.resolve(payload([42], 1))
      }
      return Promise.resolve(payload([1], page))
    })

    const { result, rerender } = renderHook((args: UseShootHistoryDataArgs) => useShootHistoryData(args), {
      wrapper: QueryWrapper,
      initialProps: baseArgs,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setOperationalPage(2))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
    ))

    rerender({ ...baseArgs, operationalFilters: { ...DEFAULT_OPERATIONAL_FILTERS, search: 'kevin' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    await waitFor(() => expect(result.current.operationalPage).toBe(1))
    await waitFor(() => expect(result.current.operationalData.map((shoot) => shoot.id)).toEqual(['42']))

    await act(async () => {
      resolvePage2?.(payload([99, 98], 2))
      await Promise.resolve()
    })
    expect(result.current.operationalData.map((shoot) => shoot.id)).toEqual(['42'])
    expect(result.current.operationalPage).toBe(1)
  })
})
