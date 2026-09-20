import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useWeatherData', () => ({
  useWeatherData: () => ({ temperature: '59', condition: 'Mostly Cloudy', distance: '5' }),
}))
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'dark' }) }))

import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext'
import { ScheduledShootListRow } from '@/components/shoots/history/ScheduledShootListRow'
import type { ShootData } from '@/types/shoots'

const shoot = {
  id: '91',
  scheduledDate: '2026-10-05',
  time: '10:00:00',
  status: 'scheduled',
  workflowStatus: 'scheduled',
  client: { name: 'Elizabeth Ann Kline', email: 'client@example.com', totalShoots: 1 },
  location: {
    address: '5629 Herberts Crossing Drive',
    city: 'Burke',
    state: 'VA',
    zip: '22015',
    fullAddress: '5629 Herberts Crossing Drive, Burke, VA 22015',
  },
  photographer: { name: 'Jaz Singh' },
  services: ['HDR Photos & Premium iGuide'],
  payment: { baseQuote: 450.16, taxRate: 0, taxAmount: 0, totalQuote: 450.16, totalPaid: 0 },
} as unknown as ShootData

describe('ScheduledShootListRow mobile list chrome', () => {
  it('stacks status and payment on the right and parks the menu in the bottom corner', () => {
    const { container } = render(
      <UserPreferencesProvider>
        <ScheduledShootListRow
          shoot={shoot}
          onSelect={vi.fn()}
          isSuperAdmin
          onDelete={vi.fn()}
          onViewInvoice={vi.fn()}
        />
      </UserPreferencesProvider>,
    )

    const pillStack = container.querySelector('[data-mobile-shoot-pills]')
    expect(pillStack).not.toBeNull()
    expect(pillStack?.className).toMatch(/flex-col/)
    expect(pillStack?.className).toMatch(/items-end/)
    expect(pillStack?.textContent).toMatch(/Scheduled/)
    expect(pillStack?.textContent).toMatch(/Unpaid/)
    expect(pillStack?.querySelector('[aria-label="More actions"]')).toBeNull()

    const header = container.querySelector('[data-mobile-shoot-header]')
    expect(header?.querySelector('[aria-label="More actions"]')).toBeNull()

    const menu = container.querySelector('[data-mobile-shoot-menu]')
    expect(menu).not.toBeNull()
    expect(menu?.className).toMatch(/md:hidden/)
    expect(screen.getAllByRole('button', { name: 'More actions' }).length).toBeGreaterThan(0)
  })
})
