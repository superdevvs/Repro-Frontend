import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext'
import { formatTimeForDisplay } from '@/utils/availabilityUtils'
import { HoldOnShootCard } from '@/components/shoots/history/HoldOnShootCard'
import { ShootListRow } from '@/components/shoots/history/ShootListRow'
import type { ShootData } from '@/types/shoots'

/**
 * Integration test for task 2.3 — modal/row time-formatting wiring.
 *
 * Task 2.1 re-routed Editing_System callers (ShootEditModal, ShootApprovalModal,
 * OverviewPhotographerPickerDialog and the Shoot History rows) through the shared
 * Time_Formatter `formatTimeForDisplay`. This test verifies the *wiring*: a shoot
 * carrying the canonical time `07:00:00` (Shoot #1) renders as `7:00 AM`, exactly
 * the Time_Formatter's output, and never leaks the raw canonical `HH:mm:ss` value
 * that inline rendering would have shown.
 *
 * The Shoot History rows are chosen as the smallest fully-renderable seam in the
 * Editing_System: they only require the UserPreferencesProvider and exercise the
 * same `formatTimeForDisplay` call site the heavier modals share.
 *
 * Validates: Requirements 1.7, 1.8
 */

const buildShoot = (overrides: Partial<ShootData> = {}): ShootData =>
  ({
    id: 'shoot-1',
    scheduledDate: '2025-12-18',
    time: '07:00:00',
    status: 'scheduled',
    workflowStatus: 'scheduled',
    client: { name: 'Test Client', email: 'client@example.com', totalShoots: 1 },
    location: {
      address: '123 Maple Street',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      fullAddress: '123 Maple Street, Austin, TX 78701',
    },
    photographer: { name: 'Jane Photographer' },
    services: ['HDR Photography'],
    payment: { baseQuote: 0, taxRate: 0, taxAmount: 0, totalQuote: 0, totalPaid: 0 },
    ...overrides,
  } as unknown as ShootData)

const renderWithPreferences = (ui: React.ReactElement) =>
  render(<UserPreferencesProvider>{ui}</UserPreferencesProvider>)

describe('Shoot History row time-formatting wiring (task 2.3)', () => {
  it('renders Shoot #1 canonical 07:00:00 as 7:00 AM in HoldOnShootCard', () => {
    const shoot = buildShoot({ time: '07:00:00', holdStatus: 'on_hold' })
    const { container } = renderWithPreferences(
      <HoldOnShootCard shoot={shoot} onSelect={vi.fn()} />,
    )

    const text = container.textContent ?? ''
    // Displays the Time_Formatter output, not the raw canonical value.
    expect(text).toContain('7:00 AM')
    expect(text).not.toContain('07:00:00')
    // The rendered string is exactly what the shared Time_Formatter produces.
    expect(text).toContain(formatTimeForDisplay(shoot.time))
  })

  it('renders Shoot #1 canonical 07:00:00 as 7:00 AM in ShootListRow', () => {
    const shoot = buildShoot({ time: '07:00:00' })
    const { container } = renderWithPreferences(
      <ShootListRow shoot={shoot} onSelect={vi.fn()} />,
    )

    const text = container.textContent ?? ''
    expect(text).toContain('7:00 AM')
    expect(text).not.toContain('07:00:00')
    expect(text).toContain(formatTimeForDisplay(shoot.time))
  })

  it('formats HH:mm:ss afternoon canonical times via the Time_Formatter (not inline logic)', () => {
    const shoot = buildShoot({ time: '13:30:00' })
    const { container } = renderWithPreferences(
      <ShootListRow shoot={shoot} onSelect={vi.fn()} />,
    )

    const text = container.textContent ?? ''
    // Inline logic that only handled HH:mm or rendered the raw value would fail this.
    expect(text).toContain('1:30 PM')
    expect(text).not.toContain('13:30:00')
    expect(text).toContain(formatTimeForDisplay('13:30:00'))
  })
})
