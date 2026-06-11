import { render, screen, within, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * MANDATORY regression test for task 9.2 — per-service time preservation in the
 * Booking_Summary.
 *
 * Task 9.1 made `BookingSummary.tsx` render every selected service's date and
 * time via the shared Time_Formatter (`formatTimeForDisplay`).
 * `getServiceScheduleLabel(serviceId)` reads from the per-service
 * `serviceSchedules` map (per-service date/time), formats the time, and only
 * falls back to the booking-level date/time when a service has no per-service
 * schedule.
 *
 * This test reproduces Shoot #2, which carries two services with DISTINCT
 * per-service canonical times:
 *   - `2D Floor Plan @ 09:30` -> must surface `9:30 AM`
 *   - `HDR @ 11:30`           -> must surface `11:30 AM`
 *
 * The core property under test (Req 12.9 / 9.1): each service's per-service
 * canonical time is PRESERVED and surfaced on its own row — the HDR time must
 * NOT be overwritten by the 2D Floor Plan time (and vice versa). The summary
 * must format via the Time_Formatter (Req 9.2/9.3), never leaking the raw
 * canonical `09:30` / `11:30` values.
 *
 * Validates: Requirements 9.1, 9.3, 12.9
 */

// The component pulls `formatTemperature` from UserPreferences and `user` (role)
// from the AuthProvider. Both are stubbed so the summary can render in isolation
// without their real providers / network dependencies.
vi.mock('@/contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    formatTemperature: (t: number) => `${t}°`,
  }),
}))

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { role: 'admin' } }),
}))

import { BookingSummary } from '@/components/booking/BookingSummary'
import { formatTimeForDisplay } from '@/utils/availabilityUtils'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const TWO_D = { id: 'svc-2d', name: '2D Floor Plan', description: '', price: 100 }
const HDR = { id: 'svc-hdr', name: 'HDR', description: '', price: 150 }

// Shoot #2: distinct per-service canonical times.
const serviceSchedules: Record<string, { date?: string; time?: string }> = {
  [TWO_D.id]: { date: '2025-12-18', time: '09:30' },
  [HDR.id]: { date: '2025-12-18', time: '11:30' },
}

const baseSummaryInfo = {
  client: 'Test Client',
  packagePrice: 250,
  address: '123 Maple Street, Austin, TX',
  bedrooms: 3,
  bathrooms: 2,
  sqft: 2000,
  // Booking-level date/time is intentionally DIFFERENT from both per-service
  // times so a fallback (overwrite) would be detectable.
  date: '2025-12-18',
  time: '8:00 AM',
}

/** Return the service-row container element for a given service name. */
const rowFor = (serviceName: string): HTMLElement => {
  const nameEl = screen.getByText(serviceName)
  // Row layout: <div row> > <div text-wrapper> > <p name/>
  const row = nameEl.closest('div')?.parentElement as HTMLElement
  expect(row).toBeTruthy()
  return row
}

describe('BookingSummary per-service time preservation (task 9.2)', () => {
  it('preserves each service\'s own canonical time (2D Floor Plan 9:30 AM, HDR 11:30 AM) without overwriting', () => {
    render(
      <BookingSummary
        summaryInfo={baseSummaryInfo}
        selectedServices={[TWO_D, HDR]}
        serviceSchedules={serviceSchedules}
      />,
    )

    const expected2d = formatTimeForDisplay('09:30')
    const expectedHdr = formatTimeForDisplay('11:30')
    expect(expected2d).toBe('9:30 AM')
    expect(expectedHdr).toBe('11:30 AM')

    // Each service row surfaces ITS OWN preserved per-service time.
    const twoDRow = rowFor('2D Floor Plan')
    expect(within(twoDRow).getByText(/9:30 AM/)).toBeInTheDocument()
    // 2D row must NOT show HDR's time.
    expect(within(twoDRow).queryByText(/11:30 AM/)).toBeNull()

    const hdrRow = rowFor('HDR')
    expect(within(hdrRow).getByText(/11:30 AM/)).toBeInTheDocument()
    // HDR row must NOT be overwritten by the 2D time.
    expect(within(hdrRow).queryByText(/9:30 AM/)).toBeNull()
  })

  it('formats via the Time_Formatter and never leaks raw canonical values', () => {
    render(
      <BookingSummary
        summaryInfo={baseSummaryInfo}
        selectedServices={[TWO_D, HDR]}
        serviceSchedules={serviceSchedules}
      />,
    )

    // Both formatted, distinct times appear exactly once (one per service row).
    expect(screen.getAllByText(/9:30 AM/)).toHaveLength(1)
    expect(screen.getAllByText(/11:30 AM/)).toHaveLength(1)

    // Raw canonical per-service values must never reach the DOM unformatted.
    // The zero-padded canonical forms (`09:30` / `11:30`) only appear if the
    // Time_Formatter was bypassed — formatted output is `9:30 AM` / `11:30 AM`.
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('09:30')
    // A bare `11:30` not followed by AM/PM would indicate a raw, unformatted leak.
    expect(text).not.toMatch(/11:30(?!\s*[AP]M)/)
  })

  it('does not collapse both services onto a single shared (overwritten) time', () => {
    render(
      <BookingSummary
        summaryInfo={baseSummaryInfo}
        selectedServices={[TWO_D, HDR]}
        serviceSchedules={serviceSchedules}
      />,
    )

    // If per-service times were overwritten by a single value, one of these
    // would appear twice (or zero times). Exactly one of each proves preservation.
    const nineThirty = screen.getAllByText(/9:30 AM/)
    const elevenThirty = screen.getAllByText(/11:30 AM/)
    expect(nineThirty).toHaveLength(1)
    expect(elevenThirty).toHaveLength(1)
  })
})
