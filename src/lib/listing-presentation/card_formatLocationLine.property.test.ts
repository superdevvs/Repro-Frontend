// Property-based test for `formatLocationLine` (sidebar card location line).
//
// Feature: map-tab-ui-improvements, Property 3: Location line omits blanks and
// has no stray separators.
//
// For any combination of city / state / zip (each possibly blank or
// whitespace-only), `formatLocationLine`:
//   - includes every non-blank, trimmed segment,
//   - excludes every blank segment,
//   - contains no leading, trailing, or doubled separators (no leading/trailing
//     comma or space, no ", ," and no doubled spaces).
//
// Validates: Requirements 3.2

import fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import { formatLocationLine } from './card'

/**
 * A "clean" token has no surrounding whitespace and no internal comma or
 * whitespace, so that splitting the output on separator runs unambiguously
 * recovers the original segments (even for non-ASCII values).
 */
const cleanToken: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('Austin', 'TX', '78701', 'Zürich', '東京', 'Москва', 'México', 'Đà'),
  fc
    .string({ minLength: 1 })
    .filter((s) => s === s.trim() && s.length > 0 && !/[,\s]/.test(s)),
)

/**
 * A single address segment: blank/whitespace-only, a clean token, or a clean
 * token padded with surrounding whitespace (which must be trimmed away).
 */
const arbitrarySegment: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '   ', '\t', '\n ', '  \t '),
  cleanToken,
  cleanToken.map((t) => `  ${t}  `),
)

describe('Feature: map-tab-ui-improvements, Property 3: Location line omits blanks and has no stray separators', () => {
  it('includes non-blank trimmed segments, drops blanks, and has no stray separators', () => {
    fc.assert(
      fc.property(arbitrarySegment, arbitrarySegment, arbitrarySegment, (city, state, zip) => {
        const result = formatLocationLine({ city, state, zip })

        const trimmed = {
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
        }
        // Expected non-blank segments, in city -> state -> zip order.
        const expectedSegments = [trimmed.city, trimmed.state, trimmed.zip].filter(
          (s) => s.length > 0,
        )

        // No leading / trailing separator characters (comma or space).
        if (result.length > 0) {
          expect(/^[,\s]/.test(result)).toBe(false)
          expect(/[,\s]$/.test(result)).toBe(false)
        }
        // No doubled separators.
        expect(result.includes(', ,')).toBe(false)
        expect(result.includes(',,')).toBe(false)
        expect(result.includes('  ')).toBe(false)

        // Every non-blank, trimmed segment appears in the output.
        for (const segment of expectedSegments) {
          expect(result.includes(segment)).toBe(true)
        }

        // Splitting on separator runs recovers exactly the non-blank segments,
        // in order — proving blanks are excluded and nothing stray is added.
        const recovered = result.split(/[,\s]+/).filter((s) => s.length > 0)
        expect(recovered).toEqual(expectedSegments)

        // When every segment is blank, the result is empty.
        if (expectedSegments.length === 0) {
          expect(result).toBe('')
        }
      }),
      { numRuns: 200 },
    )
  })
})
