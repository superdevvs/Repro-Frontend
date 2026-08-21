import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { ShootsProvider } from './ShootsProvider'

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}))

const jsonResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => JSON.stringify(payload),
  json: async () => payload,
}) as Response

describe('authenticated dashboard hydration in StrictMode', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('authToken', 'test-token')
    localStorage.setItem('user', JSON.stringify({
      id: '42',
      name: 'Pat Photographer',
      email: 'pat@example.test',
      role: 'photographer',
      metadata: {},
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests one profile and one three-tab shoot set without unhandled cancellations', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/user')) {
        return jsonResponse({
          id: 42,
          name: 'Pat Photographer',
          email: 'pat@example.test',
          role: 'photographer',
          metadata: {},
        })
      }

      return jsonResponse({
        data: [],
        meta: { current_page: 1, last_page: 1, count: 0, per_page: 25 },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unhandled = vi.fn()
    window.addEventListener('unhandledrejection', unhandled)

    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <ShootsProvider>
              <div>ready</div>
            </ShootsProvider>
          </AuthProvider>
        </MemoryRouter>
      </React.StrictMode>,
    )

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input))
      expect(urls.filter((url) => url.endsWith('/api/user'))).toHaveLength(1)
      expect(urls.filter((url) => url.includes('/api/shoots?'))).toHaveLength(3)
    })

    const shootUrls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/api/shoots?'))
    expect(shootUrls.some((url) => url.includes('tab=scheduled'))).toBe(true)
    expect(shootUrls.some((url) => url.includes('tab=completed'))).toBe(true)
    expect(shootUrls.some((url) => url.includes('tab=delivered'))).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
    expect(unhandled).not.toHaveBeenCalled()

    window.removeEventListener('unhandledrejection', unhandled)
  })
})
