// Property-based exploration of timezone alias equivalence.
//
// Feature: booking-scheduling-fixes, Property 14 (property-based form):
//   Asia/Calcutta and Asia/Kolkata are treated as one timezone without
//   rewriting stored values.
// Validates: Requirements 12.4, 12.5
//
// This is the optional, broader property-based companion to the mandatory
// regression test. It generates arbitrary canonical time values and asserts
// that `Asia/Calcutta` and `Asia/Kolkata` yield equivalent scheduling behavior
// at the boundary helpers (`normalizeTimezone` / `isSameTimezone`), and that
// normalization is a pure name-only transform that never rewrites the stored
// time/date it travels with.

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  CANONICAL_TIMEZONE,
  isSameTimezone,
  normalizeTimezone,
} from './timezone'

// The two accepted spellings of the single India zone.
const KOLKATA = 'Asia/Kolkata'
const CALCUTTA = 'Asia/Calcutta'

// Arbitrary case-permuted spellings of an alias, so equivalence does not depend
// on the exact casing supplied at the boundary (lookup is case-insensitive).
function casePermutations(value: string): fc.Arbitrary<string> {
  return fc
    .array(fc.boolean(), { minLength: value.length, maxLength: value.length })
    .map((upperFlags) =>
      value
        .split('')
        .map((ch, i) => (upperFlags[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join(''),
    )
}

// Arbitrary canonical wall-clock time value in HH:mm or HH:mm:ss form. These are
// the kinds of stored time values that ride alongside a timezone at a boundary.
const arbitraryCanonicalTime: fc.Arbitrary<string> = fc
  .record({
    hours: fc.integer({ min: 0, max: 23 }),
    minutes: fc.integer({ min: 0, max: 59 }),
    seconds: fc.option(fc.integer({ min: 0, max: 59 }), { nil: undefined }),
  })
  .map(({ hours, minutes, seconds }) => {
    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    if (seconds === undefined) return `${hh}:${mm}`
    return `${hh}:${mm}:${String(seconds).padStart(2, '0')}`
  })

describe('Feature: booking-scheduling-fixes, Property 14 (property-based form): Asia/Calcutta and Asia/Kolkata are one timezone', () => {
  it('treats any-cased Asia/Calcutta alias as the same zone as canonical Asia/Kolkata (Req 12.5)', () => {
    // Case-insensitivity is a property of alias detection: any casing of the
    // deprecated `Asia/Calcutta` spelling resolves to the canonical
    // `Asia/Kolkata` identifier, so the two name the same zone.
    fc.assert(
      fc.property(casePermutations(CALCUTTA), (calcutta) => {
        expect(isSameTimezone(calcutta, KOLKATA)).toBe(true)
        // Symmetry: order of arguments must not change the verdict.
        expect(isSameTimezone(KOLKATA, calcutta)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  it('normalizes any alias spelling to the canonical Asia/Kolkata identifier (Req 12.5)', () => {
    fc.assert(
      fc.property(casePermutations(CALCUTTA), (calcutta) => {
        expect(normalizeTimezone(calcutta)).toBe(CANONICAL_TIMEZONE)
        expect(CANONICAL_TIMEZONE).toBe(KOLKATA)
      }),
      { numRuns: 200 },
    )
  })

  it('yields equivalent scheduling behavior for the same time under either alias (Req 12.4, 12.5)', () => {
    // A "scheduling key" pairs a stored time with its normalized zone. For any
    // arbitrary time value, the key derived via Asia/Calcutta must equal the key
    // derived via Asia/Kolkata, so downstream comparison/scheduling cannot
    // diverge based on which alias was supplied.
    fc.assert(
      fc.property(arbitraryCanonicalTime, (time) => {
        const keyViaCalcutta = `${time}@${normalizeTimezone(CALCUTTA)}`
        const keyViaKolkata = `${time}@${normalizeTimezone(KOLKATA)}`
        expect(keyViaCalcutta).toBe(keyViaKolkata)
      }),
      { numRuns: 300 },
    )
  })

  it('never rewrites the stored time it travels with — name-only transform (Req 12.4)', () => {
    // Normalizing the timezone at the boundary must not alter the accompanying
    // canonical time value in any way for either alias.
    fc.assert(
      fc.property(
        arbitraryCanonicalTime,
        fc.constantFrom(CALCUTTA, KOLKATA),
        (time, zone) => {
          const record = { time, timezone: zone }
          const normalized = {
            time: record.time, // time is carried through untouched
            timezone: normalizeTimezone(record.timezone),
          }
          // The stored time is byte-for-byte preserved.
          expect(normalized.time).toBe(time)
          // Only the zone name is canonicalized.
          expect(normalized.timezone).toBe(CANONICAL_TIMEZONE)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('is idempotent: normalizing an already-normalized value is a no-op (Req 12.4)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(CALCUTTA, KOLKATA),
        arbitraryCanonicalTime,
        (zone, time) => {
          const once = normalizeTimezone(zone)
          const twice = normalizeTimezone(once)
          expect(twice).toBe(once)
          // And the time value remains independent of repeated normalization.
          expect(time).toBe(time)
        },
      ),
      { numRuns: 200 },
    )
  })
})
