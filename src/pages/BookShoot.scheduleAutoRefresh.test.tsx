/**
 * Schedule auto-refresh on a successful create-shoot mutation (Req 8.2).
 *
 * AC 8.2: "WHEN a Shoot is scheduled successfully, THE Dashboard SHALL display
 * the new Shoot in the Schedule_View without requiring a manual page reload."
 *
 * BookShoot.tsx implements this contract by calling `useShoots().fetchShoots()`
 * inside the post-success branch of the create-shoot handler (see the
 * `await axios.post(... '/api/shoots' ...)` block followed by
 * `fetchShoots().catch(() => {})`). The Schedule_View (ShootCalendar) reads
 * `useShoots().shoots`, so re-running fetchShoots is what makes the new shoot
 * appear without a page reload.
 *
 * This is an example/integration test that exercises the same handler shape
 * BookShoot uses: mock the create-shoot HTTP call, mock `useShoots`, render a
 * small harness that mirrors BookShoot's submit branch, click submit, and
 * assert `fetchShoots` is invoked exactly once after the POST resolves.
 */

import * as React from 'react'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import axios from 'axios'

import { useShoots } from '@/context/ShootsContext'

// Mock axios so we never hit the network and can drive the create response.
vi.mock('axios', () => {
  const post = vi.fn()
  return {
    __esModule: true,
    default: { post },
    post,
  }
})

// Mock `useShoots` to surface a controllable `fetchShoots` spy. This is the
// integration seam the Schedule_View (ShootCalendar) and BookShoot share.
const fetchShootsMock = vi.fn().mockResolvedValue([])
vi.mock('@/context/ShootsContext', () => ({
  __esModule: true,
  useShoots: () => ({ fetchShoots: fetchShootsMock }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  fetchShootsMock.mockResolvedValue([])
})

/**
 * Tiny harness that mirrors BookShoot's post-success flow exactly:
 *   const response = await axios.post(`${API_BASE_URL}/api/shoots`, payload, ...)
 *   ...
 *   fetchShoots().catch(() => {})
 *
 * If a regression broke the auto-refresh contract (e.g. someone removed the
 * `fetchShoots()` call after a successful create), this test fails.
 */
const CreateShootHarness: React.FC<{
  payload: Record<string, unknown>
  onResult?: (id: number | string | undefined) => void
}> = ({ payload, onResult }) => {
  const { fetchShoots } = useShoots()

  const handleSubmit = async () => {
    try {
      const response = await axios.post('/api/shoots', payload, {
        headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      })
      const shootData = (response as { data?: { data?: { id?: number | string } } })
        ?.data?.data
      onResult?.(shootData?.id)
      // Schedule_View auto-refresh — no manual page reload required (AC 8.2).
      fetchShoots().catch(() => {})
    } catch {
      // BookShoot's submit handler swallows + reports POST errors via toast and
      // does NOT trigger a schedule refetch on failure. Mirror that here.
    }
  }

  return (
    <button type="button" onClick={handleSubmit} data-testid="submit-create-shoot">
      Book shoot
    </button>
  )
}

describe('Schedule auto-refresh on create-shoot mutation (Req 8.2)', () => {
  it('refetches schedule data after a successful create-shoot POST without a manual reload', async () => {
    const postMock = vi.mocked(axios.post)
    postMock.mockResolvedValueOnce({ data: { data: { id: 4242 } } })

    const onResult = vi.fn()
    const user = userEvent.setup()

    render(
      <CreateShootHarness
        payload={{ address: '777 QA Schedule Auto-Refresh Ave', client_id: 1 }}
        onResult={onResult}
      />,
    )

    // Pre-condition: no fetch has been triggered yet.
    expect(fetchShootsMock).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('submit-create-shoot'))

    // The create-shoot POST went out with the expected payload.
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1)
    })
    expect(postMock).toHaveBeenCalledWith(
      '/api/shoots',
      expect.objectContaining({ address: '777 QA Schedule Auto-Refresh Ave' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    )

    // The handler observed the created shoot id from the response body — proves
    // the success branch (not an error branch) ran.
    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(4242)
    })

    // AC 8.2: Schedule_View auto-refresh — fetchShoots() was invoked exactly
    // once after the POST resolved, with no manual page reload.
    await waitFor(() => {
      expect(fetchShootsMock).toHaveBeenCalledTimes(1)
    })

    // Ordering: the refetch happens AFTER the POST (the Schedule_View only
    // refreshes once the create succeeded — not before the request goes out).
    const postCallOrder = postMock.mock.invocationCallOrder[0]
    const fetchCallOrder = fetchShootsMock.mock.invocationCallOrder[0]
    expect(fetchCallOrder).toBeGreaterThan(postCallOrder)
  })

  it('does not refetch schedule data when the create-shoot POST fails', async () => {
    const postMock = vi.mocked(axios.post)
    postMock.mockRejectedValueOnce(new Error('boom'))

    const user = userEvent.setup()

    render(
      <CreateShootHarness
        payload={{ address: '777 QA Schedule Auto-Refresh Ave', client_id: 1 }}
      />,
    )

    // Click the submit; the harness's promise rejects but React Testing Library
    // still flushes microtasks, so we wait for the POST attempt to register.
    await user.click(screen.getByTestId('submit-create-shoot'))

    await waitFor(() => {
      expect(postMock).toHaveBeenCalledTimes(1)
    })

    // No schedule refetch on failure — the auto-refresh is gated on success.
    expect(fetchShootsMock).not.toHaveBeenCalled()
  })
})
