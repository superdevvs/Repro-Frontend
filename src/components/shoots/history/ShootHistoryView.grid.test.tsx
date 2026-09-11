import React, { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { Calendar, Clock } from 'lucide-react'

import { ShootHistoryView, type ShootHistoryViewProps } from './ShootHistoryView'
import { useShootHistoryGridColumns } from '@/hooks/useShootHistoryGridColumns'
import {
  DEFAULT_HISTORY_FILTERS,
  DEFAULT_OPERATIONAL_FILTERS,
  type HistoryFiltersState,
} from './shootHistoryUtils'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Shoot History responsive grid columns', () => {
  it.each([
    [390, 1], [479, 1], [480, 2], [719, 2], [720, 3], [960, 3], [961, 4], [1440, 4],
  ])('fits a %ipx container without exceeding the preferred column count', (width, expected) => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: width })
    const ref = { current: container }
    const { result, rerender } = renderHook(
      ({ preferred }: { preferred: 3 | 4 }) => useShootHistoryGridColumns(ref, preferred),
      { initialProps: { preferred: 4 } },
    )

    expect(result.current).toBe(expected)
    rerender({ preferred: 3 })
    expect(result.current).toBe(Math.min(expected, 3))
    rerender({ preferred: 4 })
    expect(result.current).toBe(expected)
  })

  it('responds to sidebar/container resizing and disconnects its observer', () => {
    let resize = () => undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback }
      observe = observe
      disconnect = disconnect
    })
    const container = document.createElement('div')
    let width = 1100
    Object.defineProperty(container, 'clientWidth', { get: () => width })
    const ref = { current: container }
    const { result, unmount } = renderHook(() => useShootHistoryGridColumns(ref, 4))

    expect(observe).toHaveBeenCalledWith(container)
    expect(result.current).toBe(4)
    act(() => { width = 700; resize() })
    expect(result.current).toBe(2)
    act(() => { width = 1100; resize() })
    expect(result.current).toBe(4)
    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('falls back to window resize when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const container = document.createElement('div')
    let width = 1100
    Object.defineProperty(container, 'clientWidth', { get: () => width })
    const ref = { current: container }
    const { result, unmount } = renderHook(() => useShootHistoryGridColumns(ref, 3))

    expect(result.current).toBe(3)
    act(() => { width = 390; window.dispatchEvent(new Event('resize')) })
    expect(result.current).toBe(1)
    unmount()
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function))
  })
})

const noop = () => undefined
const emptyOptions = { clients: [], photographers: [], services: [] }

function ViewHarness({
  tab,
  initialView = 'grid',
}: {
  tab: 'delivered' | 'history'
  initialView?: 'grid' | 'list'
}) {
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [gridColumns, setGridColumns] = useState<3 | 4>(4)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>(
    tab === 'history' ? 'map' : initialView,
  )
  const [historyFilters, setHistoryFilters] = useState<HistoryFiltersState>({
    ...DEFAULT_HISTORY_FILTERS,
    viewAs: tab === 'history' ? initialView : 'map',
  })
  const props: ShootHistoryViewProps = {
    gridContainerRef,
    gridColumns,
    setGridColumns,
    isSuperAdmin: false,
    isAdmin: false,
    isEditingManager: false,
    activeTab: tab,
    setActiveTab: noop,
    tabsConfig: [
      { value: 'delivered', label: 'Delivery', icon: Calendar },
      { value: 'history', label: 'History', icon: Clock },
    ],
    pinnedTabs: new Set(),
    togglePinTab: noop,
    setIsBulkActionsOpen: noop,
    viewMode,
    setViewMode,
    historyFilters,
    setHistoryFilters,
    operationalFiltersOpen: false,
    setOperationalFiltersOpen: noop,
    historyFiltersOpen: false,
    setHistoryFiltersOpen: noop,
    fetchOperationalData: noop,
    scheduledSubTab: 'all',
    setScheduledSubTab: noop,
    inProgressSubTab: 'all',
    setInProgressSubTab: noop,
    deliveredSubTab: 'all',
    setDeliveredSubTab: noop,
    hideDeliveredSubTabs: false,
    holdSubTab: 'all',
    setHoldSubTab: noop,
    historySubTab: 'all',
    setHistorySubTab: noop,
    operationalFilters: DEFAULT_OPERATIONAL_FILTERS,
    onOperationalFilterChange: noop,
    operationalOptions: emptyOptions,
    operationalServicesSelected: false,
    resetOperationalFilters: noop,
    operationalMeta: null,
    operationalPage: 1,
    handleOperationalPageChange: noop,
    scheduledContent: null,
    completedContent: null,
    holdOnContent: null,
    featuredContent: null,
    canViewHistory: true,
    historyOptions: emptyOptions,
    onHistoryFilterChange: noop,
    historyServicesSelected: false,
    defaultHistoryFilters: DEFAULT_HISTORY_FILTERS,
    resetHistoryFilters: noop,
    historyMeta: null,
    handleHistoryPageChange: noop,
    historyContent: null,
  }

  return (
    <>
      <ShootHistoryView {...props} />
      <output data-testid="operational-view">{viewMode}</output>
      <output data-testid="history-view">{historyFilters.viewAs}</output>
    </>
  )
}

describe.each(['delivered', 'history'] as const)('Shoot History grid controls in %s', (tab) => {
  it('uses three columns after a double-click and restores four after one click', async () => {
    const user = userEvent.setup()
    const { container } = render(<ViewHarness tab={tab} />)
    const grid = screen.getByRole('radio', { name: 'Grid view' })
    const root = container.querySelector('.shoot-history-tabs')

    expect(root).toHaveAttribute('data-grid-columns', '4')
    expect(grid).toHaveAttribute('aria-checked', 'true')

    // userEvent emits both clicks followed by dblclick, matching the browser.
    await user.dblClick(grid)
    expect(root).toHaveAttribute('data-grid-columns', '3')
    expect(grid).toHaveAttribute('aria-checked', 'true')

    await user.click(grid)
    expect(root).toHaveAttribute('data-grid-columns', '4')
    expect(grid).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId(tab === 'history' ? 'operational-view' : 'history-view'))
      .toHaveTextContent('map')
  })

  it('opens compact grid from list and returns to standard grid on a later single click', async () => {
    const user = userEvent.setup()
    const { container } = render(<ViewHarness tab={tab} initialView="list" />)
    const grid = screen.getByRole('radio', { name: 'Grid view' })
    const list = screen.getByRole('radio', { name: 'List view' })
    const root = container.querySelector('.shoot-history-tabs')

    expect(list).toHaveAttribute('aria-checked', 'true')
    await user.dblClick(grid)
    expect(root).toHaveAttribute('data-grid-columns', '3')
    expect(grid).toHaveAttribute('aria-checked', 'true')

    await user.click(list)
    expect(list).toHaveAttribute('aria-checked', 'true')
    await user.click(grid)
    expect(root).toHaveAttribute('data-grid-columns', '4')
    expect(grid).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId(tab === 'history' ? 'history-view' : 'operational-view'))
      .toHaveTextContent('grid')
    expect(screen.getByTestId(tab === 'history' ? 'operational-view' : 'history-view'))
      .toHaveTextContent('map')
  })

  it.each([
    ['Shift+Enter', '{Shift>}{Enter}{/Shift}'],
    ['Shift+Space', '{Shift>} {/Shift}'],
  ])('opens compact grid with %s and restores standard grid with Enter', async (_name, keys) => {
    const user = userEvent.setup()
    const { container } = render(<ViewHarness tab={tab} initialView="list" />)
    const grid = screen.getByRole('radio', { name: 'Grid view' })
    const root = container.querySelector('.shoot-history-tabs')
    act(() => grid.focus())

    await user.keyboard(keys)
    expect(root).toHaveAttribute('data-grid-columns', '3')
    expect(grid).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{Enter}')
    expect(root).toHaveAttribute('data-grid-columns', '4')
    expect(grid).toHaveAttribute('aria-checked', 'true')
  })
})
