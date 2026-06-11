// Edit_Picker bounds + inline-422 behavior (task 3.6, optional).
//
// Exercises the pure cores extracted from `ShootEditModal` that back the
// Edit_Picker enforcement:
//   (1) out-of-bounds time selections are disabled (outside workingHours OR
//       within a blocked interval), and in-bounds selections stay enabled; and
//   (2) a backend 422 carrying `errors.start_time` surfaces an inline schedule
//       error message, while the mapping itself is a pure, non-destructive read
//       that preserves the user's other unsaved edits.
//
// **Validates: Requirements 2.1, 2.4**

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { DayAvailability } from '@/utils/availabilityProvider';
import {
  DEFAULT_START_TIME_ERROR,
  extractStartTimeScheduleError,
  isTimeOutsideDayAvailability,
  type ShootUpdateErrorBody,
} from '@/utils/editPickerBounds';

const pad2 = (n: number) => String(n).padStart(2, '0');
const hhmm = (totalMinutes: number) =>
  `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;

const day = (
  workingHours: DayAvailability['workingHours'],
  blocked: Array<{ start: string; end: string }> = [],
): DayAvailability => ({
  workingHours,
  blocked,
  fromConfig: workingHours !== null,
  timezone: 'Asia/Kolkata',
});

describe('isTimeOutsideDayAvailability — Edit_Picker disables out-of-bounds times (Req 2.1)', () => {
  const window9to6 = day({ start: '09:00', end: '18:00' });

  it('disables times before the working-hours start', () => {
    expect(isTimeOutsideDayAvailability(window9to6, '08:00')).toBe(true);
    expect(isTimeOutsideDayAvailability(window9to6, '08:59')).toBe(true);
  });

  it('disables times after the working-hours end', () => {
    expect(isTimeOutsideDayAvailability(window9to6, '18:30')).toBe(true);
    expect(isTimeOutsideDayAvailability(window9to6, '23:00')).toBe(true);
  });

  it('enables times within the working-hours window (inclusive bounds)', () => {
    expect(isTimeOutsideDayAvailability(window9to6, '09:00')).toBe(false);
    expect(isTimeOutsideDayAvailability(window9to6, '12:30')).toBe(false);
    expect(isTimeOutsideDayAvailability(window9to6, '18:00')).toBe(false);
  });

  it('disables times inside a blocked interval and enables those outside it', () => {
    const withBreak = day({ start: '09:00', end: '18:00' }, [
      { start: '12:00', end: '13:00' },
    ]);
    // [start, end): start blocked, end re-opened
    expect(isTimeOutsideDayAvailability(withBreak, '12:00')).toBe(true);
    expect(isTimeOutsideDayAvailability(withBreak, '12:30')).toBe(true);
    expect(isTimeOutsideDayAvailability(withBreak, '13:00')).toBe(false);
    expect(isTimeOutsideDayAvailability(withBreak, '11:59')).toBe(false);
  });

  it('disables nothing when no bounds are available (day === null) — backend stays authoritative', () => {
    expect(isTimeOutsideDayAvailability(null, '03:00')).toBe(false);
    expect(isTimeOutsideDayAvailability(null, '23:30')).toBe(false);
  });

  it('treats unparseable values as not-disabled (the validator rejects bad input)', () => {
    expect(isTimeOutsideDayAvailability(window9to6, 'not-a-time')).toBe(false);
    expect(isTimeOutsideDayAvailability(window9to6, '')).toBe(false);
  });

  it('property: a time is disabled iff it lies outside [start, end] or within a blocked interval', () => {
    fc.assert(
      fc.property(
        // working window
        fc.integer({ min: 0, max: 23 * 60 }),
        fc.integer({ min: 1, max: 60 }),
        // a single blocked interval inside the day
        fc.integer({ min: 0, max: 23 * 60 }),
        fc.integer({ min: 1, max: 60 }),
        // candidate time
        fc.integer({ min: 0, max: 24 * 60 - 1 }),
        (startMin, windowLen, blockStartMin, blockLen, candidateMin) => {
          const endMin = Math.min(startMin + windowLen, 24 * 60 - 1);
          const blockEndMin = Math.min(blockStartMin + blockLen, 24 * 60 - 1);

          const subject = day({ start: hhmm(startMin), end: hhmm(endMin) }, [
            { start: hhmm(blockStartMin), end: hhmm(blockEndMin) },
          ]);

          const outsideWindow = candidateMin < startMin || candidateMin > endMin;
          const insideBlock =
            candidateMin >= blockStartMin && candidateMin < blockEndMin;
          const expected = outsideWindow || insideBlock;

          expect(isTimeOutsideDayAvailability(subject, hhmm(candidateMin))).toBe(
            expected,
          );
        },
      ),
    );
  });
});

describe('extractStartTimeScheduleError — 422 surfaces inline, preserving edits (Req 2.4)', () => {
  it('returns the structured start_time message from a 422 (array form)', () => {
    const body: ShootUpdateErrorBody = {
      message: 'The given data was invalid.',
      errors: { start_time: ['Selected time is outside available hours.'] },
    };
    expect(extractStartTimeScheduleError(422, body)).toBe(
      'Selected time is outside available hours.',
    );
  });

  it('returns the structured start_time message from a 422 (string form)', () => {
    const body: ShootUpdateErrorBody = {
      errors: { start_time: 'Outside configured hours.' },
    };
    expect(extractStartTimeScheduleError(422, body)).toBe('Outside configured hours.');
  });

  it('falls back to the default message when start_time is present but empty', () => {
    expect(extractStartTimeScheduleError(422, { errors: { start_time: [''] } })).toBe(
      DEFAULT_START_TIME_ERROR,
    );
    expect(extractStartTimeScheduleError(422, { errors: { start_time: '' } })).toBe(
      DEFAULT_START_TIME_ERROR,
    );
  });

  it('returns null for a non-422 status (handled by the normal error path)', () => {
    const body: ShootUpdateErrorBody = {
      errors: { start_time: ['ignored on 500'] },
    };
    expect(extractStartTimeScheduleError(500, body)).toBeNull();
    expect(extractStartTimeScheduleError(409, body)).toBeNull();
  });

  it('returns null for a 422 that does not name start_time (e.g. a conflict on another field)', () => {
    expect(
      extractStartTimeScheduleError(422, { errors: { address: ['required'] } }),
    ).toBeNull();
    expect(extractStartTimeScheduleError(422, { message: 'Conflict' })).toBeNull();
    expect(extractStartTimeScheduleError(422, null)).toBeNull();
  });

  it('is a pure, non-destructive read — the error body is never mutated, so other unsaved edits are preserved', () => {
    const body: ShootUpdateErrorBody = {
      message: 'The given data was invalid.',
      errors: { start_time: ['Outside hours.'] },
    };
    const snapshot = JSON.parse(JSON.stringify(body));

    extractStartTimeScheduleError(422, body);

    // Surfacing the inline error is additive: it touches only the schedule-error
    // string in the component and leaves every other field of the request/state
    // untouched (mirrored here by the body remaining deep-equal to its snapshot).
    expect(body).toEqual(snapshot);
  });
});
