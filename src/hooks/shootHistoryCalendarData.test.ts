import { describe, expect, it, vi } from 'vitest'
import { calendarRangeParams, fetchCalendarPages, mapCalendarShoot } from './shootHistoryCalendarData'

describe('complete calendar pages', () => {
  it('honors the actual server page size and merges filter metadata from every page', async () => {
    const rows = Array.from({ length: 25 }, (_, id) => ({ id: id + 1 }))
    const page = vi.fn(async (current: number) => ({
      data: rows.slice((current - 1) * 12, current * 12),
      meta: { count: 25, current_page: current, per_page: 12, filters: { clients: [{ id: current, name: `Client ${current}` }], photographers: [], services: ['Photo'] } },
    }))
    const result = await fetchCalendarPages(page, new AbortController().signal)
    expect(result.rows).toEqual(rows)
    expect(page.mock.calls.map(([number]) => number)).toEqual([1, 2, 3])
    expect(result.filters.clients).toHaveLength(3)
    expect(result.filters.services).toEqual(['Photo'])
  })

  it.each(['missing metadata', 'premature empty page', 'duplicate page', 'changed total'])(
    'fails visibly instead of returning a partial calendar for %s', async (scenario) => {
      const first = Array.from({ length: 9 }, (_, id) => ({ id }))
      const page = vi.fn(async (current: number) => {
        if (scenario === 'missing metadata') return { data: first }
        return {
          data: current === 1 || scenario === 'duplicate page' ? first : [],
          meta: { total: current === 2 && scenario === 'changed total' ? 13 : 12, current_page: current, per_page: 9 },
        }
      })
      await expect(fetchCalendarPages(page, new AbortController().signal)).rejects.toThrow(/calendar|schedule changed/)
    },
  )

  it('does not publish or continue when a transport ignores cancellation', async () => {
    const controller = new AbortController()
    const page = vi.fn(async () => {
      controller.abort()
      return { data: [{ id: 1 }], meta: { total: 2, current_page: 1, per_page: 1 } }
    })
    await expect(fetchCalendarPages(page, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(page).toHaveBeenCalledTimes(1)
  })
})

describe('calendar schedule projection', () => {
  it('uses the complete inclusive range and rejects malformed or reversed dates', () => {
    expect(calendarRangeParams({ start: '2026-08-31', end: '2026-10-04' })).toEqual({ scheduled_start: '2026-08-31', scheduled_end: '2026-10-04' })
    expect(() => calendarRangeParams({ start: '2026-02-30', end: '2026-03-05' })).toThrow()
    expect(() => calendarRangeParams({ start: '2026-10-04', end: '2026-08-31' })).toThrow()
  })

  it('preserves the canonical history booking clock, fallback timezone, redacted fields, and TBD', () => {
    const source = { id: 7, scheduledDate: '2026-09-28', time: '9:30 AM', timezone: 'America/New_York', scheduledAt: '2026-10-10T22:00:00Z', address: { street: '7 Main St', city: 'Baltimore' }, client: { name: null }, photographer: { name: null }, financials: { totalQuote: 0 } }
    expect(mapCalendarShoot(source, true)).toMatchObject({ scheduledDate: '2026-09-28', time: '09:30', timezone: 'America/New_York', location: { address: '7 Main St' }, payment: { totalQuote: 0 } })
    expect(mapCalendarShoot({ ...source, time: null, scheduledAt: null }, true).time).toBe('TBD')
    expect(mapCalendarShoot({ ...source, scheduledDate: null, time: null, scheduledAt: '2026-09-29T01:30:00Z' }, true)).toMatchObject({ scheduledDate: '2026-09-28', time: '21:30' })
  })
})
