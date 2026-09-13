import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { ShootsProvider } from './ShootsProvider'
import { useShoots } from './shootsContextState'

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

const HydrationProbe = () => {
  const { isInitialLoading, fetchShoots } = useShoots()
  return <>
    <output data-testid="hydration">{isInitialLoading ? 'loading' : 'ready'}</output>
    <button onClick={() => { void fetchShoots() }}>Refresh shoots</button>
  </>
}

const renderHydrationProbe = () => render(
  <React.StrictMode>
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider><ShootsProvider><HydrationProbe /></ShootsProvider></AuthProvider>
    </MemoryRouter>
  </React.StrictMode>,
)

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

  it('waits for initial shoot data and keeps background refreshes usable', async () => {
    const pending: Array<(response: Response) => void> = []
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/user')) {
        return Promise.resolve(jsonResponse(JSON.parse(localStorage.getItem('user')!)))
      }
      return new Promise<Response>(resolve => pending.push(resolve))
    }))
    renderHydrationProbe()

    await waitFor(() => expect(pending).toHaveLength(3))
    expect(screen.getByTestId('hydration').textContent).toBe('loading')
    await act(async () => {
      pending.splice(0).forEach(resolve => resolve(jsonResponse({ data: [] })))
    })
    await waitFor(() => expect(screen.getByTestId('hydration').textContent).toBe('ready'))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh shoots' }))
    await waitFor(() => expect(pending).toHaveLength(3))
    expect(screen.getByTestId('hydration').textContent).toBe('ready')
    await act(async () => {
      pending.splice(0).forEach(resolve => resolve(jsonResponse({ data: [] })))
    })
  })

  it('releases initial loading after a failed shoot request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/user')) {
        return jsonResponse(JSON.parse(localStorage.getItem('user')!))
      }
      throw new Error('Network unavailable')
    }))
    renderHydrationProbe()
    await waitFor(() => expect(screen.getByTestId('hydration').textContent).toBe('ready'))
  })
})
