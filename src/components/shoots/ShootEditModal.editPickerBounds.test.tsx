import { describe, expect, it } from 'vitest'

import type { DayAvailability } from '@/utils/availabilityProvider'
import {
  DEFAULT_START_TIME_ERROR,
  extractStartTimeScheduleError,
  isTimeOutsideDayAvailability,
  type ShootUpdateErrorBody,
} from '@/utils/editPickerBounds'

/**
 * Optional Edit_Picker bounds frontend test (task 3.6).
 *
 * Task 3.5 wired `ShootEditModal` to:
 *   - disable Edit_Picker times outside `DayAvailability.workingHours` (and inside
 *     `blocked` intervals) via the pure `isTimeOutsideDayAvailability` predicate —
 *     the same bounds the backend Availability_Validator enforces, and
 *   - map a backend 422 `errors.start_time` into an inline `scheduleError` via the
 *     pure `extractStartTimeScheduleError` reader, WITHOUT discarding other unsaved
 *     edits.
 *
 * Mounting the full modal is impractical here (it depends on AuthProvider, media
 * queries, the photographers/services/shoot fetch fan-out, and Radix/vaul jsdom
 * shims). Per the task guidance, the bounds-disabling logic and the 422-handling
 * behavior are exercised at the smallest accessible seam: the pure cores extracted
 * from the modal in task 3.5. The "preserves unsaved edits" guarantee is proven by
 * showing the 422 mapping is a pure, additive read that never mutates edit state.
 *
 * Validates: Requirements 2.1, 2.4
 */

/** Effective working window 09:00–18:00 with a midday block (12:00–13:00). */
const day: DayAvailability = {
  workingHours: { start: '09:00', end: '18:00' },
  blocked: [{ start: '12:00', end: '13:00' }],
  fromConfig: true,
  timezone: 'Asia/Kolkata',
}

describe('Edit_Picker bounds disabling — isTimeOutsideDayAvailability (Req 2.1)', () => {
  it('disables times before the working-hours start', () => {
    expect(isTimeOutsideDayAvailability(day, '08:00')).toBe(true)
    expect(isTimeOutsideDayAvailability(day, '08:59')).toBe(true)
  })

  it('disables times after the working-hours end', () => {
    expect(isTimeOutsideDayAvailability(day, '18:30')).toBe(true)
    expect(isTimeOutsideDayAvailability(day, '23:00')).toBe(true)
  })

  it('enables in-window times and the inclusive boundaries', () => {
    expect(isTimeOutsideDayAvailability(day, '09:00')).toBe(false) // start boundary
    expect(isTimeOutsideDayAvailability(day, '10:30')).toBe(false)
    expect(isTimeOutsideDayAvailability(day, '18:00')).toBe(false) // end boundary
  })

  it('disables times inside a blocked interval (start inclusive, end exclusive)', () => {
    expect(isTimeOutsideDayAvailability(day, '12:00')).toBe(true) // block start
    expect(isTimeOutsideDayAvailability(day, '12:30')).toBe(true)
    expect(isTimeOutsideDayAvailability(day, '13:00')).toBe(false) // block end is bookable
  })

  it('accepts HH:mm:ss canonical input without leaking seconds into the bound check', () => {
    expect(isTimeOutsideDayAvailability(day, '07:00:00')).toBe(true) // before start
    expect(isTimeOutsideDayAvailability(day, '10:00:00')).toBe(false) // in window
  })

  it('disables nothing when no client-side bounds are available (backend stays authoritative)', () => {
    expect(isTimeOutsideDayAvailability(null, '03:00')).toBe(false)
    expect(isTimeOutsideDayAvailability(null, '21:00')).toBe(false)
  })

  it('never disables an unparseable value (the backend validator rejects bad input)', () => {
    expect(isTimeOutsideDayAvailability(day, '')).toBe(false)
    expect(isTimeOutsideDayAvailability(day, 'not-a-time')).toBe(false)
  })
})

describe('Inline 422 surfacing — extractStartTimeScheduleError (Req 2.4)', () => {
  it('returns the structured errors.start_time message on a 422', () => {
    const body: ShootUpdateErrorBody = {
      message: "The selected time is outside the photographer's available hours.",
      errors: {
        start_time: [
          'Photographer is available 09:00–18:00 on Tuesday; 19:30 is outside this window.',
        ],
      },
    }

    expect(extractStartTimeScheduleError(422, body)).toBe(
      'Photographer is available 09:00–18:00 on Tuesday; 19:30 is outside this window.',
    )
  })

  it('falls back to the default message when start_time is present but empty', () => {
    expect(extractStartTimeScheduleError(422, { errors: { start_time: [] } })).toBe(
      DEFAULT_START_TIME_ERROR,
    )
  })

  it('accepts a plain string start_time value', () => {
    expect(
      extractStartTimeScheduleError(422, { errors: { start_time: 'Outside hours' } }),
    ).toBe('Outside hours')
  })

  it('returns null for non-422 responses (handled by the normal error path)', () => {
    const body: ShootUpdateErrorBody = { errors: { start_time: ['ignored'] } }
    expect(extractStartTimeScheduleError(500, body)).toBeNull()
    expect(extractStartTimeScheduleError(200, body)).toBeNull()
  })

  it('returns null on a 422 that does not name start_time (e.g. a conflict on photographer_id)', () => {
    const body: ShootUpdateErrorBody = {
      errors: { photographer_id: ['Photographer is not available at the selected time.'] },
    }
    expect(extractStartTimeScheduleError(422, body)).toBeNull()
  })

  it('does not mutate the response body when reading the error', () => {
    const body: ShootUpdateErrorBody = {
      errors: { start_time: ['Outside hours'] },
    }
    const snapshot = JSON.parse(JSON.stringify(body))
    extractStartTimeScheduleError(422, body)
    expect(body).toEqual(snapshot)
  })
})

describe('422 surfacing preserves other unsaved edits (Req 2.4)', () => {
  // A minimal stand-in for the modal edit state. Applying a schedule error must be
  // an additive update: only `scheduleError` changes; every other unsaved field
  // (address, notes, services, the edited time itself) is left intact.
  interface EditState {
    address: string
    shootNotes: string
    selectedServiceIds: string[]
    scheduledTime: string
    scheduleError: string | null
  }

  /** Mirrors the modal's submitApproval mapping: surface the 422 inline, keep edits. */
  const applyUpdateResponse = (
    state: EditState,
    status: number,
    body: ShootUpdateErrorBody | null,
  ): EditState => {
    const scheduleError = extractStartTimeScheduleError(status, body)
    if (scheduleError == null) return state
    return { ...state, scheduleError }
  }

  it('sets scheduleError on a 422 while leaving all other edits untouched', () => {
    const before: EditState = {
      address: '3300 Lake Austin Blvd',
      shootNotes: 'Bring wide lens',
      selectedServiceIds: ['1', '4'],
      scheduledTime: '19:30',
      scheduleError: null,
    }

    const after = applyUpdateResponse(before, 422, {
      errors: { start_time: ['19:30 is outside this window.'] },
    })

    // The inline error is surfaced...
    expect(after.scheduleError).toBe('19:30 is outside this window.')
    // ...and the user's other unsaved edits are preserved verbatim.
    expect(after.address).toBe('3300 Lake Austin Blvd')
    expect(after.shootNotes).toBe('Bring wide lens')
    expect(after.selectedServiceIds).toEqual(['1', '4'])
    expect(after.scheduledTime).toBe('19:30')
  })
})
