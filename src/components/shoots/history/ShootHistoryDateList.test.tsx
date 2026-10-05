import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShootHistoryDateList } from './ShootHistoryDateList'

afterEach(() => { cleanup(); vi.useRealTimers() })
describe('Shoot History date separators', () => {
  it('groups same-day rows and labels today, tomorrow, and later dates without changing server order', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 5, 12))
    render(<ShootHistoryDateList dates={['2026-10-05', '2026-10-05', '2026-10-06', '2026-11-16']}>
      {['a', 'b', 'c', 'd'].map(id => <button key={id}>{id}</button>)}
    </ShootHistoryDateList>)
    expect(screen.getAllByRole('heading').map(node => node.textContent)).toEqual([
      'Today • 2 shoots', 'Tomorrow • 1 shoot', 'Monday, 16 November 2026 • 1 shoot',
    ])
    expect(screen.getAllByRole('button').map(node => node.textContent)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('shows undated rows together instead of dropping them', () => {
    render(<ShootHistoryDateList dates={[null, undefined]}><button>A</button><button>B</button></ShootHistoryDateList>)
    expect(screen.getByRole('heading').textContent).toBe('Date not set • 2 shoots')
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
