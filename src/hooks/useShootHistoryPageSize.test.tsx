import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_HISTORY_FILTERS,
  DEFAULT_OPERATIONAL_FILTERS,
} from '@/components/shoots/history/shootHistoryUtils'
import { shootHistoryPageSizeStorageKey } from '@/components/shoots/history/shootHistoryPageSize'
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
  user: { id: '7', name: 'Ada', email: 'ada@example.com', role: 'admin' } as UseShootHistoryDataArgs['user'],
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

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({
    data: {
      data: [{ id: 1, scheduled_date: '2026-09-28', time: '10:00:00', status: 'scheduled' }],
      meta: { current_page: 1, per_page: 12, total: 40 },
    },
  })
})
afterEach(cleanup)

const QueryWrapper = ({ children }: { children: React.ReactNode }) => {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('Shoot History page size', () => {
  it('resets to page 1 and refetches with the selected per_page', async () => {
    const { result } = renderHook(() => useShootHistoryData(baseArgs), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setOperationalPage(3))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ page: 3, per_page: 12 }) }),
    ))
    mocks.get.mockClear()
    act(() => result.current.handlePageSizeChange(48))
    await waitFor(() => expect(result.current.operationalPage).toBe(1))
    await waitFor(() => expect(result.current.pageSize).toBe(48))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ page: 1, per_page: 48 }) }),
    ))
    expect(localStorage.getItem(shootHistoryPageSizeStorageKey('7'))).toBe('48')
  })

  it('loads the page size saved for the signed-in user', async () => {
    localStorage.setItem(shootHistoryPageSizeStorageKey('7'), '96')
    localStorage.setItem(shootHistoryPageSizeStorageKey('9'), '24')
    const { result } = renderHook(() => useShootHistoryData(baseArgs), { wrapper: QueryWrapper })
    await waitFor(() => expect(result.current.pageSize).toBe(96))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(
      '/shoots',
      expect.objectContaining({ params: expect.objectContaining({ per_page: 96 }) }),
    ))
  })
})
