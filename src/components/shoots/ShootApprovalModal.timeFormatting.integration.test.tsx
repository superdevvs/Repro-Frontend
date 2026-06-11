import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ShootApprovalModal } from '@/components/shoots/ShootApprovalModal'
import { formatTimeForDisplay } from '@/utils/availabilityUtils'

/**
 * Integration test for task 2.3 — Editing_System *modal* time-formatting wiring.
 *
 * Task 2.1 re-routed the Editing_System modals (ShootEditModal, ShootApprovalModal,
 * OverviewPhotographerPickerDialog) through the shared Time_Formatter
 * `formatTimeForDisplay`. This test verifies the wiring at the modal seam: when the
 * ShootApprovalModal loads a shoot carrying a canonical time, the schedule time
 * control renders the exact 12-hour string produced by `formatTimeForDisplay`
 * (and never the raw canonical `HH:mm:ss` value that inline rendering would show).
 *
 * Key cases:
 *   - Shoot #1 canonical `07:00:00` -> `7:00 AM` (Req 1.8)
 *   - An afternoon `HH:mm:ss` value (`13:30:00` -> `1:30 PM`) proves the modal is
 *     not using an `HH:mm`-only inline formatter and is not leaking seconds.
 *
 * ShootApprovalModal is chosen as the most testable modal seam: it is a pure
 * Radix Dialog with no AuthProvider dependency, fetches the shoot on open, and
 * renders the schedule time through the same `formatTimeForDisplay` call site the
 * heavier ShootEditModal shares.
 *
 * Validates: Requirements 1.7, 1.8
 */

type FetchMock = ReturnType<typeof vi.fn>

const buildShootResponse = (time: string) => ({
  data: {
    id: 1,
    address: '123 Maple Street',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    client: { id: 1, name: 'Test Client', email: 'client@example.com' },
    services: [],
    serviceItems: [],
    scheduled_date: '2025-12-18',
    time,
    photographer: { id: 1, name: 'Jane Photographer' },
  },
})

/**
 * A fetch mock that distinguishes the shoot-details endpoint (returns the canonical
 * shoot) from every other call (availability lookups -> empty payload).
 */
const installFetchMock = (time: string): FetchMock => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.includes('/api/shoots/')
      ? buildShootResponse(time)
      : { data: [] }
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  // Radix/vaul primitives rendered inside the modal probe these APIs in jsdom.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  if (!('ResizeObserver' in window)) {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const photographers = [{ id: 1, name: 'Jane Photographer' }]

describe('ShootApprovalModal time-formatting wiring (task 2.3)', () => {
  it('renders Shoot #1 canonical 07:00:00 as 7:00 AM via the shared Time_Formatter', async () => {
    installFetchMock('07:00:00')

    render(
      <ShootApprovalModal
        isOpen
        shootId={1}
        photographers={photographers}
        onClose={vi.fn()}
      />,
    )

    // The schedule time control surfaces the exact Time_Formatter output.
    const expected = formatTimeForDisplay('07:00:00')
    expect(expected).toBe('7:00 AM')

    const matches = await screen.findAllByText(expected)
    expect(matches.length).toBeGreaterThan(0)

    // The raw canonical value must never leak into the modal.
    expect(document.body.textContent).not.toContain('07:00:00')
  })

  it('formats an afternoon HH:mm:ss canonical time (13:30:00 -> 1:30 PM), proving non-inline / seconds-safe formatting', async () => {
    installFetchMock('13:30:00')

    render(
      <ShootApprovalModal
        isOpen
        shootId={1}
        photographers={photographers}
        onClose={vi.fn()}
      />,
    )

    const expected = formatTimeForDisplay('13:30:00')
    expect(expected).toBe('1:30 PM')

    await waitFor(() => {
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0)
    })

    // An HH:mm-only inline formatter or raw render would leak the seconds.
    expect(document.body.textContent).not.toContain('13:30:00')
  })
})
