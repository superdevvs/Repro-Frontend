import React from 'react'
import { act, cleanup, renderHook, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShootHistoryFilters } from './useShootHistoryFilters'
import { useShootHistoryCalendarState } from './useShootHistoryCalendarState'
import { DEFAULT_HISTORY_FILTERS } from '@/components/shoots/history/shootHistoryUtils'
import { ShootHistoryDisplayControls } from '@/components/shoots/history/ShootHistoryDisplayControls'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('On-Hold visibility', () => {
  it.each(['saved', 'url'])('opens all holds in list view with a %s calendar preference', source => {
    if (source === 'saved') localStorage.setItem('shootHistory_viewMode', 'calendar')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[source === 'url' ? '/?tab=hold&view=calendar' : '/?tab=hold']}>{children}</MemoryRouter>
    )
    const { result } = renderHook(() => useShootHistoryFilters({ role: 'salesRep', isEditor: false, canViewHistory: true }), { wrapper })
    expect(result.current.activeTab).toBe('hold')
    expect(result.current.viewMode).toBe('list')
    act(() => result.current.setActiveTab('scheduled'))
    expect(result.current.viewMode).toBe('calendar')
    act(() => { result.current.setActiveTab('hold'); result.current.setViewMode('grid') })
    expect(result.current.viewMode).toBe('grid')
  })

  it('does not request a date-limited calendar for holds', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>
    const { result } = renderHook(() => useShootHistoryCalendarState({ activeTab: 'hold', viewMode: 'calendar', historyFilters: DEFAULT_HISTORY_FILTERS, historySubTab: 'all' }), { wrapper })
    expect(result.current.active).toBe(false)
    expect(result.current.range).toBeUndefined()
  })

  it('offers list and grid without a calendar control for holds', () => {
    render(<ShootHistoryDisplayControls view="list" onViewChange={vi.fn()} gridColumns={3} onGridColumnsChange={vi.fn()} allowCalendar={false} />)
    expect(screen.queryByRole('button', { name: 'Calendar view' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Switch to grid view' })).toBeTruthy()
  })
})
