import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_HISTORY_FILTERS,
  DEFAULT_OPERATIONAL_FILTERS,
} from '@/components/shoots/history/shootHistoryUtils'
import { useShootHistoryFilters } from './useShootHistoryFilters'
import { useShootHistoryData, type UseShootHistoryDataArgs } from './useShootHistoryData'

const mocks = vi.hoisted(() => ({ get: vi.fn(), toast: vi.fn() }))
vi.mock('@/services/api', () => ({ apiClient: { get: mocks.get }, getApiHeaders: () => ({}), getImpersonatedUserId: () => null }))
vi.mock('@/hooks/useShootHistoryMapGeocoding', () => ({
  useShootHistoryMapGeocoding: () => ({ geoCache: {}, setGeoCache: vi.fn() }),
}))

const router = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>
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

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.get.mockResolvedValue({
    data: {
      data: [
        { id: 9, scheduled_date: '2026-09-28', time: '10:00:00', status: 'scheduled' },
        { id: 2, scheduled_date: '2026-09-29', time: '09:00:00', status: 'scheduled' },
        { id: 11, scheduled_date: '2026-09-27', time: '14:00:00', status: 'scheduled' },
      ],
      meta: { current_page: 1, per_page: 12, total: 30 },
    },
  })
})
afterEach(cleanup)

const QueryWrapper = ({ children }: { children: React.ReactNode }) => { const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } })); return <QueryClientProvider client={client}>{children}</QueryClientProvider>; };

describe('Shoot History sort selection', () => {
  it.each(['admin', 'superadmin', 'editing_manager', 'salesRep', 'photographer', 'client', 'editor'])(
    'provides the appropriate default and retains each tab selection for %s',
    (role) => {
      const { result } = renderHook(() => useShootHistoryFilters({
        role, isEditor: role === 'editor', canViewHistory: role !== 'photographer',
      }), { wrapper: router })
      const initialTab = result.current.activeTab
      expect(result.current.shootSort).toBe(role === 'editor' ? 'date_desc' : 'today_upcoming')

      act(() => result.current.setShootSort('date_asc'))
      act(() => result.current.setViewMode('grid'))
      expect(result.current.shootSort).toBe('date_asc')
      act(() => result.current.setActiveTab(role === 'editor' ? 'edited' : 'delivered'))
      expect(result.current.shootSort).toBe('date_desc')
      act(() => result.current.setActiveTab(initialTab))
      expect(result.current.shootSort).toBe('date_asc')
    },
  )
})

describe('Shoot History server ordering', () => {
  it('keeps the server sequence and sort selection when switching list and grid', async () => {
    const { result, rerender } = renderHook((args: UseShootHistoryDataArgs) => useShootHistoryData(args), {
      wrapper: QueryWrapper, initialProps: baseArgs,
    })
    await waitFor(() => expect(result.current.operationalData.map((shoot) => shoot.id)).toEqual(['9', '2', '11']))
    expect(mocks.get).toHaveBeenCalledWith('/shoots', expect.objectContaining({
      params: expect.objectContaining({ sort: 'next_up', page: 1, per_page: 12 }),
    }))
    mocks.get.mockClear()
    rerender({ ...baseArgs, viewMode: 'grid' })
    expect(result.current.operationalData.map((shoot) => shoot.id)).toEqual(['9', '2', '11'])
    expect(mocks.get).not.toHaveBeenCalled()
  })

  it('starts a changed operational sort on page one rather than reordering the current page', async () => {
    const { result, rerender } = renderHook((args: UseShootHistoryDataArgs) => useShootHistoryData(args), {
      wrapper: QueryWrapper, initialProps: baseArgs,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setOperationalPage(3))
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/shoots', expect.objectContaining({
      params: expect.objectContaining({ sort: 'next_up', page: 3 }),
    })))
    mocks.get.mockClear()
    rerender({ ...baseArgs, shootSort: 'date_desc' })
    await waitFor(() => expect(result.current.operationalPage).toBe(1))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.get.mock.calls.length).toBeGreaterThan(0)
    for (const [path, config] of mocks.get.mock.calls.filter(([path]) => path === '/shoots')) {
      expect(path).toBe('/shoots')
      expect(config.params).toMatchObject({ sort: 'date_desc' })
      expect([1, 2]).toContain(config.params.page)
    }
  })

  it('applies a changed history sort before pagination and includes it in export parameters', async () => {
    const args: UseShootHistoryDataArgs = { ...baseArgs, activeTab: 'history', shootSort: 'date_desc' }
    const { result, rerender } = renderHook((props: UseShootHistoryDataArgs) => useShootHistoryData(props), {
      wrapper: QueryWrapper, initialProps: args,
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setHistoryPage(2))
    await waitFor(() => expect(mocks.get).toHaveBeenLastCalledWith('/shoots/history', expect.objectContaining({
      params: expect.objectContaining({ sort: 'date_desc', page: 2 }),
    })))
    mocks.get.mockClear()
    rerender({ ...args, shootSort: 'date_asc' })
    await waitFor(() => expect(result.current.historyPage).toBe(1))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.get.mock.calls.length).toBeGreaterThan(0)
    for (const [path, config] of mocks.get.mock.calls) {
      expect(path).toBe('/shoots/history')
      expect(config.params).toMatchObject({ sort: 'date_asc', page: 1 })
    }
    expect(result.current.buildHistoryParams()).toMatchObject({ sort: 'date_asc', page: 1 })
  })
})
