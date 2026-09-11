import React, { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { Calendar, Clock } from 'lucide-react'

import { ShootHistoryView, type ShootHistoryViewProps } from './ShootHistoryView'
import { useShootHistoryGridColumns } from '@/hooks/useShootHistoryGridColumns'
import { CompletedAlbumCard } from './CompletedAlbumCard'
import { HoldOnShootCard } from './HoldOnShootCard'
import { SharedShootCard } from '@/components/shoots/SharedShootCard'
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext'
import type { ShootData } from '@/types/shoots'

vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light' }) }))
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

const glassShoot = {
  id: 'glass-shoot',
  scheduledDate: '2026-09-11', time: '09:00', status: 'delivered', workflowStatus: 'delivered',
  heroImage: 'https://images.example.test/property.jpg',
  media: { images: [{ url: 'https://images.example.test/property.jpg' }] },
  client: { name: 'Example Client', email: 'client@example.com', phone: '202-555-0100' },
  photographer: { name: 'Example Photographer' },
  location: { address: '123 Sample Street', city: 'Washington', state: 'DC', zip: '20001', fullAddress: '123 Sample Street, Washington DC' },
  services: ['HDR Photography', 'Floor Plan'],
  payment: { baseQuote: 250, taxRate: 0, taxAmount: 0, totalQuote: 250, totalPaid: 250 },
  notes: { editingNotes: 'Keep natural colors', approvalNotes: 'Confirmed access' },
} as unknown as ShootData

const renderGlassCard = (node: React.ReactNode) => (
  <UserPreferencesProvider>{node}</UserPreferencesProvider>
)

describe('Shoot History glass cards', () => {
  it.each([
    ['completed', (compact: boolean) => <CompletedAlbumCard shoot={glassShoot} compact={compact} onSelect={vi.fn()} isAdmin viewerRole="admin" />],
    ['scheduled', (compact: boolean) => <SharedShootCard shoot={glassShoot} compact={compact} role="admin" />],
    ['on hold', (compact: boolean) => <HoldOnShootCard shoot={glassShoot} compact={compact} onSelect={vi.fn()} isAdmin viewerRole="admin" />],
  ] as const)('preserves all %s card details and typography while applying glass only in three-column mode', (_name, card) => {
    const { container, rerender } = render(renderGlassCard(card(false)))
    const standardText = container.textContent
    const headingClasses = container.querySelector('h3')?.className
    expect(container.querySelector('.shoot-glass-card')).toBeNull()

    rerender(renderGlassCard(card(true)))
    expect(container.querySelector('.shoot-glass-card')).not.toBeNull()
    const panel = container.querySelector('.shoot-glass-panel')
    expect(panel).not.toBeNull()
    expect(panel).toHaveTextContent('HDR Photography')
    expect(panel).toHaveTextContent('Floor Plan')
    expect(panel).toHaveTextContent('Example Client')
    expect(panel).toHaveTextContent('Example Photographer')
    expect(panel).toHaveTextContent('Keep natural colors')
    expect(container.textContent).toBe(standardText)
    expect(container.querySelector('h3')?.className).toBe(headingClasses)

    rerender(renderGlassCard(card(false)))
    expect(container.querySelector('.shoot-glass-card')).toBeNull()
    expect(container.querySelector('.shoot-glass-panel')).toBeNull()
    expect(container.textContent).toBe(standardText)
  })

  it('keeps hidden hero images hidden and uses the existing placeholder on image failure', () => {
    const { container, rerender } = render(renderGlassCard(<SharedShootCard shoot={glassShoot} compact hideHeroImage role="admin" />))
    expect(container.querySelector('img')).toBeNull()
    rerender(renderGlassCard(<CompletedAlbumCard shoot={glassShoot} compact onSelect={vi.fn()} />))
    const image = container.querySelector('img')!
    expect(image).toHaveClass('shoot-glass-card-image')
    expect(image).toHaveAttribute('src', 'https://images.example.test/property.jpg')
    act(() => image.dispatchEvent(new Event('error')))
    expect(image.getAttribute('src')).not.toBe('https://images.example.test/property.jpg')
  })

  it.each([
    ['completed', <CompletedAlbumCard shoot={glassShoot} compact onSelect={vi.fn()} />],
    ['scheduled', <SharedShootCard shoot={glassShoot} compact role="admin" />],
  ] as const)('keeps the %s photo in its own clear hero and supplies its colors to the detail extension', (_name, card) => {
    const { container } = render(renderGlassCard(card))
    const image = container.querySelector('img')!
    expect(image.parentElement).toHaveClass('shoot-glass-hero')
    expect(container.querySelector('.shoot-glass-card')).toHaveStyle({
      '--shoot-glass-image': 'url("https://images.example.test/property.jpg")',
    })
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('.shoot-glass-panel > .shoot-glass-blur')).toHaveAttribute('aria-hidden', 'true')
  })

  it.each([
    ['completed', <CompletedAlbumCard shoot={glassShoot} compact onSelect={vi.fn()} isAdmin viewerRole="admin" />],
    ['scheduled', <SharedShootCard shoot={glassShoot} compact role="admin" />],
  ] as const)('aligns the %s photographer label and name with the right content edge', (_name, card) => {
    const { getByText } = render(renderGlassCard(card))
    const block = getByText('Example Photographer').parentElement
    expect(block).toHaveClass('text-right')
    expect(block?.querySelector('div')).toHaveClass('justify-end')
  })

  it('retains download interactions without opening the card', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn(), onDownload = vi.fn()
    render(renderGlassCard(<CompletedAlbumCard shoot={glassShoot} compact onSelect={onSelect} onDownload={onDownload} />))
    await user.click(screen.getByRole('button', { name: 'Downloads' }))
    expect(onDownload).toHaveBeenCalledWith(glassShoot, 'full')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('copies address and client contact from a completed card without opening it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(renderGlassCard(<CompletedAlbumCard shoot={glassShoot} compact onSelect={onSelect} isAdmin viewerRole="admin" />))

    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    await user.click(screen.getByRole('button', { name: 'Copy client name' }))
    await user.click(screen.getByRole('button', { name: 'Copy client email' }))
    await user.click(screen.getByRole('button', { name: 'Copy client phone' }))

    expect(writeText.mock.calls.map((call) => call[0])).toEqual([
      '123 Sample Street',
      'Example Client',
      'client@example.com',
      '202-555-0100',
    ])
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('Shoot History grid transitions', () => {
  it.each([false, true])('animates only actual column switches with reduced motion set to %s', (reduced) => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 1100 })
    const grid = document.createElement('div')
    grid.className = 'masonry-grid'
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel }))
    Object.defineProperty(grid, 'animate', { value: animate })
    container.appendChild(grid)
    const ref = { current: container }
    const { rerender, unmount } = renderHook(
      ({ preferred }: { preferred: 3 | 4 }) => useShootHistoryGridColumns(ref, preferred),
      { initialProps: { preferred: 4 } },
    )

    expect(animate).not.toHaveBeenCalled()
    rerender({ preferred: 3 })
    expect(animate).toHaveBeenCalledTimes(reduced ? 0 : 1)
    if (!reduced) expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0.7, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 180, easing: 'ease-out' },
    )
    rerender({ preferred: 4 })
    expect(animate).toHaveBeenCalledTimes(reduced ? 0 : 2)
    expect(cancel).toHaveBeenCalledTimes(reduced ? 0 : 1)
    unmount()
    expect(cancel).toHaveBeenCalledTimes(reduced ? 0 : 2)
  })
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
  it('toggles three and four columns on each single click and handles rapid clicks consistently', async () => {
    const user = userEvent.setup()
    const { container } = render(<ViewHarness tab={tab} />)
    const grid = screen.getByRole('radio', { name: 'Grid view' })
    const root = container.querySelector('.shoot-history-tabs')

    expect(root).toHaveAttribute('data-grid-columns', '4')
    expect(grid).toHaveAttribute('aria-checked', 'true')

    await user.click(grid)
    expect(root).toHaveAttribute('data-grid-columns', '3')
    expect(grid).toHaveAttribute('aria-checked', 'true')
    await user.click(grid)
    expect(root).toHaveAttribute('data-grid-columns', '4')

    // userEvent emits both clicks followed by dblclick, matching the browser.
    await user.dblClick(grid)
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
    await user.click(grid)
    expect(root).toHaveAttribute('data-grid-columns', '4')
    await user.click(grid)
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

  it.each(['{Enter}', ' '])('toggles columns with a single %s key activation', async (key) => {
    const user = userEvent.setup()
    const { container } = render(<ViewHarness tab={tab} />)
    const grid = screen.getByRole('radio', { name: 'Grid view' })
    act(() => grid.focus())
    await user.keyboard(key)
    expect(container.querySelector('.shoot-history-tabs')).toHaveAttribute('data-grid-columns', '3')
    await user.keyboard(key)
    expect(container.querySelector('.shoot-history-tabs')).toHaveAttribute('data-grid-columns', '4')
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
